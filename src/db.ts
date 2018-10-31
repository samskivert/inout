import { observable, transaction } from "mobx"
import * as firebase from "firebase"
import * as M from "./model"
import * as U from "./util"

type Ref = firebase.firestore.DocumentReference
type Data = firebase.firestore.DocumentData
type ColRef = firebase.firestore.CollectionReference

// returns 'Midnight, Jan 1 {year}' as a Date
const yearDate = (year :number) => new Date(year, 0)

export class Items<I extends M.Item> {
  private _unsubscribe = () => {}

  @observable pending = true
  @observable items :I[] = []

  constructor (readonly query :firebase.firestore.Query, decoder :(ref :Ref, data :Data) => I) {
    console.log(`Subscribing to query: ${query}`)
    this._unsubscribe = query.onSnapshot(snap => {
      let newItems :I[] = []
      // TODO: track by key, re-read existing items, create new, toss old
      snap.forEach(doc => {
        const data = doc.data()
        const item = decoder(doc.ref, data)
        item.read(data)
        newItems.push(item)
      })
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

export class ItemCollection<I extends M.Item> {

  constructor (readonly col :() => ColRef, readonly decoder :(ref :Ref, data :Data) => I) {}

  items (completionYear :number|void = undefined) :Items<I> {
    const colref = this.col()
    const query = (completionYear ?
                   colref.where("completed", ">=", yearDate(completionYear)).
                          where("completed", "<", yearDate(completionYear+1)) :
                   colref.where("completed", "==", null))
    return new Items<I>(query, this.decoder)
  }

  async create (text :string) :Promise<I> {
    const data = {text, created: firebase.firestore.FieldValue.serverTimestamp(), completed: null}
    const docref = await this.col().add(data)
    return this.decoder(docref, data)
  }
}

export class DB {
  db = firebase.firestore()
  uid :string = "none"
  buildables = new ItemCollection(() => this.userCollection("buildables"),
                                  (ref, data) => new M.Build(ref, data))

  constructor () {
    this.db.settings({timestampsInSnapshots: true})
    this.db.enablePersistence().catch(error => {
      console.warn(`Failed to enable offline mode: ${error}`)
    })
  }

  setUserId (uid :string) {
    this.uid = uid
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

  private userCollection (name :string) :ColRef {
    return this.db.collection("users").doc(this.uid).collection(name)
  }
}
