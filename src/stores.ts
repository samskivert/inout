import { computed, observable, IObservableValue } from "mobx"
import * as firebase from "firebase"
import * as DB from "./db"
import * as M from "./model"
import * as U from "./util"

//
// View models for to-x items

function splitTags (text :string) :string[] {
  return text.split(" ").map(tag => tag.trim()).filter(tag => tag.length > 0)
}

const tagSuffRe = /(.*)#([^ ]+)$/
function popTags (text :string, tags :string[]) :string {
  let matches = tagSuffRe.exec(text)
  if (!matches) return text
  tags.push(matches[2])
  return popTags(matches[1].trim(), tags)
}

class SyncProp<T> {
  value :IObservableValue<T>
  constructor (readonly name :string, defval :T) {
    this.value = observable.box(defval)
  }
  startEdit (data :M.Item) {
    this.value.set(data[this.name])
  }
  commitEdit (data :M.Item) {
    data[this.name] = this.value.get()
  }
}

class TagsProp extends SyncProp<string> {
  constructor () { super("tags", "") }
  startEdit (data :M.Item) {
    this.value.set(data.tags.join(" "))
  }
  commitEdit (data :M.Item) {
    const tags = this.value.get()
    data.tags = tags ? splitTags(tags) : []
  }
}

export abstract class ItemStore {
  protected props :SyncProp<any>[] = []

  @observable editing = false
  readonly editTags = this.addProp(new TagsProp())
  @observable editCompleted :string|null = null

  get key () :string { return this.item.ref.id }

  abstract get item () :M.Item

  completeItem () {
    this.item.completed = U.toStamp(new Date())
  }
  uncompleteItem () {
    this.item.completed = null
  }

  deleteItem () {
    this.item.ref.delete().catch(error => {
      console.warn(`Failed to delete item [${this.item.ref.id}]: ${error}`)
      // TODO: feedback in UI
    })
  }

  startEdit () {
    this.editCompleted = this.item.completed
    this.editing = true
    for (let prop of this.props) {
      prop.startEdit(this.item)
    }
  }
  commitEdit () {
    this.editing = false
    this.item.completed = this.editCompleted
    for (let prop of this.props) {
      prop.commitEdit(this.item)
    }
  }
  cancelEdit () {
    this.editing = false
  }

  protected syncProp<T> (name :string, defval :T) :SyncProp<T> {
    return this.addProp(new SyncProp(name, defval))
  }
  protected addProp<T> (prop :SyncProp<T>) :SyncProp<T> {
    this.props.push(prop)
    return prop
  }
}

export abstract class ProtractedStore extends ItemStore {
  readonly editStarted = this.syncProp<string|void>("started", undefined)

  abstract get item () :M.Protracted

  startItem () {
    this.item.started = U.toStamp(new Date())
  }
}

export class BuildStore extends ProtractedStore {
  readonly editText = this.syncProp("text", "")

  constructor (readonly item :M.Build) { super() }
}

export class ReadStore extends ProtractedStore {
  readonly editTitle = this.syncProp("title", "")
  readonly editAuthor = this.syncProp("author", "")
  readonly editType = this.syncProp("type", "book")
  readonly editAbandoned = this.syncProp("abandoned", false)

  constructor (readonly item :M.Read) { super() }
}

//
// View models for to-x lists

type Partition = {
  title :string,
  stores :ItemStore[]
}

export abstract class ToXStore<I extends M.Item> {
  readonly items :DB.Items<I>
  // TODO: revamp to be based on a backing map from id?
  @computed get itemStores () :ItemStore[] { return this._storesFor(this.items) }
  abstract get partitions () :Partition[]

  @observable doneYear :number|void = undefined
  @observable doneItems :DB.Items<I>|void = undefined
  @computed get doneItemStores () :ItemStore[]|void {
    return this.doneItems ? this._storesFor(this.doneItems) : undefined
  }
  abstract get doneTitle () :string

  @observable newItem :string = ""

  constructor (readonly coll :DB.ItemCollection<I>) {
    this.items = coll.items()
    this.setDoneYear(new Date().getFullYear())
  }

  async setDoneYear (year :number) {
    if (year !== this.doneYear) {
      this.doneYear = year
      if (this.doneItems) {
        this.doneItems.close()
        this.doneItems = undefined
      }
      this.doneItems = await this.coll.items(year)
    }
  }

  async rollDoneYear (delta :number) {
    if (this.doneYear) this.setDoneYear(this.doneYear + delta)
  }

  async addItem (text :string) {
    try {
      const tags :string[] = []
      text = popTags(text, tags)
      const data = this.newItemData(text)
      data.tags = tags
      this.coll.create(data)
    } catch (error) {
      console.warn(`Failed to create item (text: ${text})`)
      console.warn(error)
      // TODO: UI Feedback
    }
  }

  // TODO: someone needs to call close!
  close () {
    this.items.close()
    this.doneItems && this.doneItems.close()
  }

  protected _storesFor (items :DB.Items<I>) :ItemStore[] {
    let stores :ItemStore[] = []
    for (let item of items.items) {
      stores.push(this.newStore(item))
    }
    return stores
  }

  protected abstract newStore (item :I) :ItemStore
  protected abstract newItemData (text :string) :{[field :string]: any}
}

export abstract class ToLongXStore<I extends M.Protracted> extends ToXStore<I> {

  abstract get title () :string
  abstract get startedTitle () :string

  get partitions () :Partition[] {
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
  get doneTitle () :string { return "Built" }

  constructor (db :DB.DB) { super(db.build) }

  protected newStore (item :M.Build) { return new BuildStore(item) }
  protected newItemData (text :string) { return {text} }
}

export class ToReadStore extends ToLongXStore<M.Read> {

  get title () :string { return "To Read" }
  get startedTitle () :string { return "Reading" }
  get doneTitle () :string { return "Read" }

  constructor (db :DB.DB) { super(db.read) }

  protected newStore (item :M.Read) { return new ReadStore(item) }
  protected newItemData (text :string) {
    const dashIdx = text.indexOf(" - ")
    if (dashIdx < 0) return {title: text}
    const [title, author] = text.split(" - ")
    return {title, author, type: "book"}
  }
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
  build   :ToBuildStore
  read    :ToReadStore

  constructor (db :DB.DB) {
    this.journal = new JournumStore(db, new Date())
    this.build = new ToBuildStore(db)
    this.read = new ToReadStore(db)
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
  @observable mode = Tab.READ // Tab.JOURNAL
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
