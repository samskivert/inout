import { observable, transaction } from "mobx"
import * as firebase from "firebase"
import * as M from "./model"
import * as U from "./util"

type ColRef = firebase.firestore.CollectionReference
type Data = firebase.firestore.DocumentData
type Query = firebase.firestore.Query
type Ref = firebase.firestore.DocumentReference
const Timestamp = firebase.firestore.Timestamp

abstract class QueryResult<T> {
  private _unsubscribe = () => {}

  @observable pending = true
  @observable items :T[] = []

  get sortedItems () :T[] {
    const items = this.items.slice()
    items.sort(this.sortComp)
    return items
  }

  constructor (query :Query, readonly sortComp :(a :T, b :T) => number) {
    this._unsubscribe = query.onSnapshot(snap => {
      transaction(() => {
        snap.docChanges().forEach(change => {
          const data = change.doc.data()
          switch (change.type) {
          case "added":
            // console.log(`Adding item @ ${change.newIndex}: ${change.doc.ref.id} :: ${JSON.stringify(data)}`)
            this.items.splice(change.newIndex, 0, this.newEntry(change.doc.ref, data))
            break
          case "modified":
            // console.log(`Updating item @ ${change.newIndex}: ${change.doc.ref.id} :: ${JSON.stringify(data)}`)
            this.updateEntry(this.items[change.newIndex], change.doc.ref, data)
            break
          case "removed":
            // console.log(`Removing item @ ${change.oldIndex}: ${change.doc.ref.id}`)
            this.items.splice(change.oldIndex, 1)
          }
        })
        this.pending = false
      })
    })
  }

  protected abstract newEntry (ref :Ref, data :Data) :T
  protected abstract updateEntry (entry :T, ref :Ref, newData :Data) :void

  close () {
    this._unsubscribe()
  }
}

export class Items extends QueryResult<M.Item> {

  constructor (query :Query, sortComp :(a :M.Item, b :M.Item) => number,
               readonly decoder :(ref :Ref, data :Data) => M.Item) {
    super(query, sortComp)
  }

  protected newEntry (ref :Ref, data :Data) :M.Item {
    // newly added items have a null created timestamp, so fill it in
    if (!data.created) data.created = Timestamp.now()
    // console.log(`Adding item @ ${change.newIndex}: ${change.doc.ref.id} :: ${JSON.stringify(data)}`)
    const item = this.decoder(ref, data)
    item.read(data)
    return item
  }

  protected updateEntry (item :M.Item, ref :Ref, newData :Data) {
    item.read(newData)
  }
}

const ByCreated = (a :M.Item, b :M.Item) => b.created.seconds - a.created.seconds
const ByCompleted = (a :M.Item, b :M.Item) =>
  (b.completed.value || "").localeCompare(a.completed.value || "")

export class ItemCollection {

  constructor (readonly db :DB,
               readonly name :string,
               readonly decoder :(ref :Ref, data :Data) => M.Item) {}

  get col () :ColRef { return this.db.userCollection(this.name) }

  items (completionYear :number|void = undefined) :Items {
    const query = (completionYear === undefined ?
                   this.col.where("completed", "==", null) :
                   this.col.where("completed", ">=", `${completionYear}-01-01`).
                            where("completed", "<", `${completionYear+1}-01-01`))
    const sorter = completionYear === undefined ? ByCreated : ByCompleted
    return new Items(query, sorter, this.decoder)
  }

  completed () :Items {
    return new Items(this.completedQuery, ByCompleted, this.decoder)
  }
  recentCompleted () :Items {
    return new Items(this.completedQuery.limit(5), ByCompleted, this.decoder)
  }
  private get completedQuery () {
    console.log(`Loading completed: ${this.name}...`)
    return this.col.where("completed", ">=", "1900-01-01").orderBy("completed", "desc") }

  async create (data :Data) :Promise<M.Item> {
    if (!data.created) data.created = firebase.firestore.FieldValue.serverTimestamp()
    if (!data.completed) data.completed = null
    const docref = await this.col.add(data)
    return this.decoder(docref, data)
  }
}

export class Annum extends QueryResult<M.Journum> {

  constructor (journal :ColRef, readonly year :number) {
    super(journal.where("date", ">=", `${year  }-01-01`)
                 .where("date", "<",  `${year+1}-01-01`),
          (a, b) => b.date.localeCompare(a.date))
  }

  protected newEntry (ref :Ref, data :Data) :M.Journum {
    return new M.Journum(ref, data, false)
  }
  protected updateEntry (entry :M.Journum, ref :Ref, newData :Data) {
    entry.read(newData)
  }
}

export class DB {
  db = firebase.firestore()
  uid :string = "none"
  build = new ItemCollection(this, "build", (ref, data) => new M.Build(ref, data))
  read  = new ItemCollection(this, "read",  (ref, data) => new M.Read(ref, data))
  watch = new ItemCollection(this, "watch", (ref, data) => new M.Watch(ref, data))
  hear  = new ItemCollection(this, "hear",  (ref, data) => new M.Hear(ref, data))
  play  = new ItemCollection(this, "play",  (ref, data) => new M.Play(ref, data))
  dine  = new ItemCollection(this, "dine",  (ref, data) => new M.Dine(ref, data))

  constructor () {
    this.db.settings({timestampsInSnapshots: true})
    this.db.enablePersistence().catch(error => {
      console.warn(`Failed to enable offline mode: ${error}`)
    })
  }

  coll (type :M.ItemType) :ItemCollection {
    switch (type) {
    case M.ItemType.BUILD: return this.build
    case M.ItemType.READ: return this.read
    case M.ItemType.WATCH: return this.watch
    case M.ItemType.HEAR: return this.hear
    case M.ItemType.PLAY: return this.play
    case M.ItemType.DINE: return this.dine
    default: return this.build // TODO
    }
  }

  setUserId (uid :string) {
    this.uid = uid
  }

  userCollection (name :string) :ColRef {
    return this.db.collection("users").doc(this.uid).collection(name)
  }

  async journal (date :U.Stamp) :Promise<M.Journum> {
    console.log(`Loading journal ${date}`)
    let ref = this.userCollection("journal").doc(date)
    try {
      let doc = await ref.get()
      let data = doc.data() || {date, entries: {}}
      if (!doc.exists) ref.set(data).
        then(() => console.log(`Yay, created ${ref.id}`)).
        catch(err => console.warn(`Failed to set ${ref.id}: ${err}`))
      else console.log(`Loaded existing journum ${date}: ${JSON.stringify(data)}`)
      return new M.Journum(ref, data)
    } catch (error) {
      console.log(`Failed to load journal [uid=${this.uid}, ref=${ref.path}, date=${date}]`, error)
      throw new Error(`Database error`)
    }
  }

  async createJournal (data :Data) {
    let dstamp = data.date
    if (!dstamp) throw new Error(`Missing 'date' property.`)
    console.log(`Creating journal entry: ${dstamp}`)
    let ref = this.userCollection("journal").doc(dstamp)
    return ref.set(data)
  }

  journalYear (year :number) :Annum {
    return new Annum(this.userCollection("journal"), year)
  }
}
