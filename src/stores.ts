import { computed, observable } from "mobx"
import * as firebase from "firebase"
import * as DB from "./db"
import * as M from "./model"
import * as U from "./util"

//
// View models for to-x items

const tagSuffRe = /(.*)#([^ ]+)$/
function popTags (text :string, tags :string[]) :string {
  let matches = tagSuffRe.exec(text)
  if (!matches) return text
  tags.push(matches[2])
  return popTags(matches[1].trim(), tags)
}

export class ItemStore {
  @observable editing = false

  get key () :string { return this.item.ref.id }

  constructor (readonly item :M.Item) {}

  completeItem () {
    this.item.completed.syncValue.set(U.toStamp(new Date()))
  }
  uncompleteItem () {
    this.item.completed.syncValue.set(null)
  }

  startItem () {
    if (this.item instanceof M.Protracted) {
      this.item.started.syncValue.set(U.toStamp(new Date()))
    }
  }

  deleteItem () {
    this.item.ref.delete().catch(error => {
      console.warn(`Failed to delete item [${this.item.ref.id}]: ${error}`)
      // TODO: feedback in UI
    })
  }

  startEdit () {
    this.editing = true
    this.item.startEdit()
  }
  commitEdit () {
    this.editing = false
    this.item.commitEdit()
  }
  cancelEdit () {
    this.editing = false
  }
}

//
// View models for to-x lists

type Partition = {
  title :string,
  stores :ItemStore[]
}

export abstract class ToXStore {
  readonly items :DB.Items
  // TODO: revamp to be based on a backing map from id?
  @computed get itemStores () :ItemStore[] { return this._storesFor(this.items) }
  abstract get title () :string
  get partitions () :Partition[] { return [{title: this.title, stores: this.itemStores}] }

  @observable doneYear :number|void = undefined
  @observable doneItems :DB.Items|void = undefined
  @computed get doneItemStores () :ItemStore[]|void {
    return this.doneItems ? this._storesFor(this.doneItems) : undefined
  }
  abstract get doneTitle () :string

  @observable newItem :string = ""

  constructor (readonly coll :DB.ItemCollection) {
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
      if (tags.length > 0) data.tags = tags
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

  importLegacy (text :string) {
    const data = JSON.parse(text)
    for (let {when, meta, archived, text} of data) {
      if ((meta === "done=t") !== archived) {
        console.log(`meta / archived mismatch? ${meta} // ${archived}`)
      }
      this.coll.create(this.legacyItemData(text, new Date(when), archived))
    }
  }

  protected legacyItemData (text :string, when :Date, done :boolean) :{[field :string]: any} {
    const tags :string[] = []
    text = popTags(text, tags)
    const data = this.newItemData(text)
    if (tags.length > 0) data.tags = tags
    data.created = when
    if (done) data.completed = U.toStamp(when)
    return data
  }

  protected _storesFor (items :DB.Items) :ItemStore[] {
    let stores :ItemStore[] = []
    for (let item of items.items) {
      stores.push(new ItemStore(item))
    }
    return stores
  }

  protected abstract newItemData (text :string) :{[field :string]: any}
}

export abstract class ToLongXStore extends ToXStore {

  abstract get startedTitle () :string

  get partitions () :Partition[] {
    const stores = this.itemStores
    const pending = (store :ItemStore) => (store.item as M.Protracted).started.value === undefined
    const parts = [{title: this.title, stores: stores.filter(pending)}]
    const started = stores.filter(store => !pending(store))
    if (started.length > 0) parts.unshift({title: this.startedTitle, stores: started})
    return parts
  }

  protected legacyItemData (text :string, when :Date, done :boolean) :{[field :string]: any} {
    const data = super.legacyItemData(text, when, done)
    if (data.completed) data.started = data.completed
    return data
  }
}

export class ToBuildStore extends ToLongXStore {
  get title () :string { return "To Build" }
  get startedTitle () :string { return "Building" }
  get doneTitle () :string { return "Built" }
  constructor (db :DB.DB) { super(db.build) }
  protected newItemData (text :string) { return {text} }
}

export class ToReadStore extends ToLongXStore {
  get title () :string { return "To Read" }
  get startedTitle () :string { return "Reading" }
  get doneTitle () :string { return "Read" }
  constructor (db :DB.DB) { super(db.read) }

  protected newItemData (text :string) {
    const dashIdx = text.indexOf(" - ")
    if (dashIdx < 0) return {title: text, type: "book"}
    const [title, author] = text.split(" - ")
    return {title, author, type: "book"}
  }
}

export class ToWatchStore extends ToXStore {
  get title () :string { return "To See" }
  get doneTitle () :string { return "Seen" }
  constructor (db :DB.DB) { super(db.watch) }
  protected newItemData (text :string) {
    const dashIdx = text.indexOf(" - ")
    if (dashIdx < 0) return {title: text, type: "film"}
    const [title, director] = text.split(" - ")
    return {title, director, type: "film"}
  }
}

export class ToHearStore extends ToXStore {
  get title () :string { return "To Hear" }
  get doneTitle () :string { return "Heard" }
  constructor (db :DB.DB) { super(db.hear) }
  protected newItemData (text :string) { return {title: text, type: "song"} }
}

export class ToPlayStore extends ToLongXStore {
  get title () :string { return "To Play" }
  get startedTitle () :string { return "Playing" }
  get doneTitle () :string { return "Play" }
  constructor (db :DB.DB) { super(db.play) }
  protected newItemData (text :string) { return {title: text, platform: "pc"} }
}

export class ToDineStore extends ToXStore {
  get title () :string { return "To Dine" }
  get doneTitle () :string { return "Dined" }
  constructor (db :DB.DB) { super(db.dine) }
  protected newItemData (text :string) { return {name: text} }
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
// View models for bulk item editing

export class BulkStore {
  @observable type = M.ItemType.READ
  @observable legacyData :string = ""

  constructor (readonly db :DB.DB, readonly stores :Stores) {}

  get items () :DB.Items {
    const items = this._items
    if (items !== null && this.type === this._itemsType) return items
    if (items) items.close()
    this._itemsType = this.type
    return this._items = this.db.coll(this.type).allItems()
  }
  private _itemsType :M.ItemType|null = null
  private _items :DB.Items|null = null
}

//
// View models for the top-level app

export class Stores {
  journal :JournumStore
  build   :ToBuildStore
  read    :ToReadStore
  watch   :ToWatchStore
  hear    :ToHearStore
  play    :ToPlayStore
  dine    :ToDineStore
  bulk    :BulkStore

  constructor (db :DB.DB) {
    this.journal = new JournumStore(db, new Date())
    this.build = new ToBuildStore(db)
    this.read = new ToReadStore(db)
    this.watch = new ToWatchStore(db)
    this.hear = new ToHearStore(db)
    this.play = new ToPlayStore(db)
    this.dine = new ToDineStore(db)
    this.bulk = new BulkStore(db, this)
  }

  storeFor (type :M.ItemType) {
    switch (type) {
    case M.ItemType.BUILD: return this.build
    case  M.ItemType.READ: return this.read
    case M.ItemType.WATCH: return this.watch
    case  M.ItemType.HEAR: return this.hear
    case  M.ItemType.PLAY: return this.play
    case  M.ItemType.DINE: return this.dine
    default: throw new Error(`Unknown type: ${type}`)
    }
  }

  close () {
    this.journal.close()
    this.build.close()
  }
}

export enum Tab { JOURNAL, BUILD, READ, WATCH, HEAR, PLAY, DINE, DO, BULK }

export class AppStore {
  readonly db = new DB.DB()
  @observable user :firebase.User|null = null
  @observable mode = Tab.BULK // Tab.JOURNAL
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
