import { observable, transaction } from "mobx"
import * as firebase from "firebase"
import * as M from "./model"
import * as U from "./util"

type Ref = firebase.firestore.DocumentReference
type Data = firebase.firestore.DocumentData
type ColRef = firebase.firestore.CollectionReference

export class Items {
  private _unsubscribe = () => {}

  @observable pending = true
  @observable items :M.Item[] = []

  constructor (readonly query :firebase.firestore.Query,
               decoder :(ref :Ref, data :Data) => M.Item,
               sortComp :(a :M.Item, b :M.Item) => number) {
    this._unsubscribe = query.onSnapshot(snap => {
      let newItems :M.Item[] = []
      // TODO: track by key, re-read existing items, create new, toss old
      snap.forEach(doc => {
        const data = doc.data()
        const item = decoder(doc.ref, data)
        item.read(data)
        newItems.push(item)
      })
      newItems.sort(sortComp)
      transaction(() => {
        this.pending = false
        this.items = newItems
      })
    })
  }

  close () {
    this._unsubscribe()
  }
}

const ByCreated = (a :M.Item, b :M.Item) => a.created.seconds - b.created.seconds
const ByCompleted = (a :M.Item, b :M.Item) =>
  (b.completed.value || "").localeCompare(a.completed.value || "")
const ByHistory = (a :M.Item, b :M.Item) => {
  if (a.completed.value && b.completed.value) return ByCompleted(a, b)
  if (a.completed.value) return 1
  if (b.completed.value) return -1
  return ByCreated(a, b)
}

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
    return new Items(query, this.decoder, sorter)
  }

  allItems () :Items {
    return new Items(this.col, this.decoder, ByHistory)
  }

  async create (data :Data) :Promise<M.Item> {
    if (!data.created) data.created = firebase.firestore.FieldValue.serverTimestamp()
    if (!data.completed) data.completed = null
    const docref = await this.col.add(data)
    return this.decoder(docref, data)
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

  async journal (date :Date) :Promise<M.Journum> {
    console.log(`Loading journal ${date}`)
    let dstamp = U.toStamp(date)
    let ref = this.userCollection("journal").doc(dstamp)
    try {
      let doc = await ref.get()
      let data = doc.data() || {date: dstamp, entries: {}}
      if (!doc.exists) ref.set(data).
        then(() => console.log(`Yay, created ${ref.id}`)).
        catch(err => console.warn(`Failed to set ${ref.id}: ${err}`))
      else console.log(`Loaded existing journum ${dstamp}: ${JSON.stringify(data)}`)
      return new M.Journum(ref, data)
    } catch (error) {
      console.log(`Failed to load journal [uid=${this.uid}, ref=${ref.path}, date=${dstamp}]`, error)
      throw new Error(`Database error`)
    }
  }
}
