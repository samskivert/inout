import { computed, observable } from "mobx"
import * as firebase from "firebase"
import * as DB from "./db"
import * as M from "./model"
import * as U from "./util"

//
// View models for to-x items

export abstract class ItemStore {
  @observable editing = false
  @observable editCompleted :string|null = null

  get key () :string { return this.item.ref.id }

  abstract get item () :M.Item
  abstract getText () :string

  completeItem () {
    this.item.completed = U.toStamp(new Date())
  }

  deleteItem () {
    this.item.ref.delete().catch(error => {
      console.warn(`Failed to delete item [${this.item.ref.id}]: ${error}`)
      // TODO: feedback in UI
    })
  }

  startEdit () {
    this.editing = true
    this.editCompleted = this.item.completed
  }
  commitEdit () {
    this.editing = false
    this.item.completed = this.editCompleted
  }
  cancelEdit () {
    this.editing = false
  }
}

export abstract class ProtractedStore extends ItemStore {
  @observable editStarted :string|void = undefined

  abstract get item () :M.Protracted

  startItem () {
    this.item.started = U.toStamp(new Date())
  }

  startEdit () {
    this.editStarted = this.item.started
    super.startEdit()
  }
  commitEdit () {
    this.item.started = this.editStarted
    super.commitEdit()
  }
}

export class BuildStore extends ProtractedStore {
  @observable editText = ""

  constructor (readonly item :M.Build) { super() }

  getText () :string { return this.item.text }

  startEdit () {
    this.editText = this.item.text
    super.startEdit()
  }
  commitEdit () {
    this.item.text = this.editText
    super.commitEdit()
  }
}

//
// View models for to-x lists

type Partition = {
  title :string,
  stores :ItemStore[]
}

export abstract class ToXStore<I extends M.Item> {
  readonly items :DB.Items<I>

  @observable newItem :string = ""

  @computed get itemStores () :ItemStore[] {
    let stores :ItemStore[] = []
    for (let item of this.items.items) {
      stores.push(this.newStore(item))
    }
    return stores
  }

  abstract partitions () :Partition[]

  constructor (readonly coll :DB.ItemCollection<I>) {
    this.items = coll.items()
  }

  async addItem (text :string) {
    try {
      this.coll.create(text)
    } catch (error) {
      console.warn(`Failed to create item (text: ${text})`)
      console.warn(error)
      // TODO: UI Feedback
    }
  }

  // TODO: someone needs to call close!
  close () {
    this.items.close()
  }

  protected abstract newStore (item :I) :ItemStore
}

export abstract class ToLongXStore<I extends M.Protracted> extends ToXStore<I> {

  abstract get title () :string
  abstract get startedTitle () :string

  partitions () :Partition[] {
    const stores = this.itemStores
    const pending = (store :ItemStore) => (store.item as M.Protracted).started === undefined
    const parts = [{title: this.title, stores: stores.filter(pending)}]
    const started = stores.filter(store => !pending(store))
    if (started.length > 0) parts.unshift({title: this.startedTitle, stores: started})
    return parts
  }
}

export class ToBuildStore extends ToLongXStore<M.Build> {

  get title () :string { return "To Build" }
  get startedTitle () :string { return "Building" }

  constructor (db :DB.DB) { super(db.buildables) }

  protected newStore (item :M.Build) { return new BuildStore(item) }
}

//
// View model for journal lists and entries there-in

export class EntryStore {
  @observable editText :string|void = undefined
  @observable showMenu = false

  constructor (readonly journum :M.Journum, readonly entry :M.Entry) {}

  get key () :string { return this.entry.key }

  moveItem (delta :number) { this.journum.moveEntry(this.entry.key, delta) }
  deleteItem () { this.journum.deleteEntry(this.entry.key) }

  startEdit () {
    this.editText = this.entry.text
  }
  handleEdit (key :string) {
    if (key === "Escape") this.cancelEdit()
    else if (key === "Enter") this.commitEdit()
  }
  commitEdit () {
    if (this.editText) {
      this.entry.text = this.editText
    }
    this.editText = undefined
  }
  cancelEdit () {
    this.editText = undefined
  }
}

export class JournumStore {
  @observable currentDate :Date
  @observable current :M.Journum|void = undefined
  @observable newEntry :string = ""

  // we track entry stores by key so that we can preserve them across changes to Journum.entries
  // (mainly reorderings)
  entryStores :Map<string, EntryStore> = new Map()

  @computed get entries () :EntryStore[] {
    const jm = this.current
    const entries :EntryStore[] = []
    if (jm) {
      for (let ent of jm.entries) {
        let es = this.entryStores.get(ent.key)
        if (!es) this.entryStores.set(ent.key, es = new EntryStore(jm, ent))
        entries.push(es)
      }
      // TODO: prune old stores?
    } else this.entryStores.clear()
    return entries
  }

  constructor (readonly db :DB.DB, startDate :Date) {
    this.currentDate = startDate
    this._setDate(startDate)
  }

  close () {
    if (this.current) {
      this.current.close()
      this.current = undefined
    }
  }

  setDate (date :Date) {
    if (U.toStamp(date) !== U.toStamp(this.currentDate)) {
      this.currentDate = date
      this._setDate(date)
    }
  }

  async _setDate (date :Date) {
    if (this.current) {
      this.current.close()
      this.current = undefined
    }
    this.current = await this.db.journal(date)
  }

  async rollDate (days :number) {
    let date = new Date(this.currentDate)
    date.setDate(this.currentDate.getDate() + days)
    // this.pickingDate = undefined // also clear picking date
    return this.setDate(date)
  }
  async goToday () {
    this.setDate(new Date())
  }

  @observable pickingDate :string|void = undefined

  startPick () {
    this.pickingDate = U.toStamp(this.currentDate)
  }
  updatePick (stamp :string|void) {
    if (stamp) {
      this.pickingDate = stamp
      const date = U.fromStamp(stamp)
      date && this.setDate(date)
    }
  }
  commitPick () {
    this.pickingDate = undefined
  }
}

//
// View models for the top-level app

export class Stores {
  journal :JournumStore
  build :ToBuildStore

  constructor (db :DB.DB) {
    this.journal = new JournumStore(db, new Date())
    this.build = new ToBuildStore(db)
  }

  close () {
    this.journal.close()
    this.build.close()
  }
}

export enum Tab { JOURNAL, BUILD, READ, SEE, LISTEN, PLAY, EAT, DO }

export class AppStore {
  readonly db = new DB.DB()
  @observable user :firebase.User|null = null
  @observable mode = Tab.BUILD // Tab.JOURNAL
  // this can't be a @computed because of MobX tracking depends through a constructor into the
  // constructed object itself which is idiotic, but yay for magic
  stores :Stores|null = null

  constructor () {
    firebase.auth().onAuthStateChanged(user => {
      if (user) console.log(`User logged in: ${user.uid}`)
      else console.log('User logged out.')
      this.db.setUserId(user ? user.uid : "none")
      if (this.stores) this.stores.close()
      if (user) this.stores = new Stores(this.db)
      else this.stores = null
      this.user = user
    })
  }
}
