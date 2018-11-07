import { computed, observable } from "mobx"
import * as firebase from "firebase"
import * as DB from "./db"
import * as M from "./model"
import * as U from "./util"

//
// View model for journal lists and entries there-in

export class EntryStore {
  @observable showMenu = false
  @observable editing = false

  constructor (readonly journum :M.Journum, readonly entry :M.Entry) {}

  get key () :string { return this.entry.key }

  moveItem (delta :number) { this.journum.moveEntry(this.entry.key, delta) }
  deleteItem () { this.journum.deleteEntry(this.entry.key) }

  startEdit () {
    this.entry.startEdit()
    this.showMenu = false
    this.editing = true
  }
  handleEdit (key :string) {
    if (key === "Escape") this.cancelEdit()
    else if (key === "Enter") this.commitEdit()
  }
  commitEdit () {
    this.entry.commitEdit()
    this.editing = false
  }
  cancelEdit () {
    this.editing = false
  }
}

function getCachedEntryStores (journum :M.Journum, storeCache :Map<string, EntryStore>) {
  const stores :EntryStore[] = []
  for (let ent of journum.entries) {
    let es = storeCache.get(ent.key)
    if (!es) storeCache.set(ent.key, es = new EntryStore(journum, ent))
    stores.push(es)
  }
  // TODO: prune old stores? nah!
  return stores
}

export type JournalMode = "current" | "history"

export class JournalStore {
  @observable mode :JournalMode = "current"

  constructor (readonly db :DB.DB) {
    this.currentDate = U.toStamp(new Date())
    this._setDate(this.currentDate)
  }

  close () {
    if (this.current) {
      this.current.close()
      this.current = undefined
    }
  }

  //
  // Current stuff

  @observable currentDate :U.Stamp
  @observable current :M.Journum|void = undefined
  @observable newEntry :string = ""

  // we track entry stores by key so that we can preserve them across changes to Journum.entries
  // (mainly reorderings)
  entryStores :Map<string, EntryStore> = new Map()

  @computed get entries () :EntryStore[] {
    if (this.current) return getCachedEntryStores(this.current, this.entryStores)
    this.entryStores.clear()
    return []
  }

  setDate (date :U.Stamp) {
    if (date !== this.currentDate) {
      this.currentDate = date
      this._setDate(date)
    }
  }

  async _setDate (date :U.Stamp) {
    if (this.current) {
      this.current.close()
      this.current = undefined
    }
    this.current = await this.db.journal(date)
  }

  async rollDate (days :number) {
    let date = new Date(this.currentDate)
    date.setDate(date.getDate() + days)
    // this.pickingDate = undefined // also clear picking date
    return this.setDate(U.toStamp(date))
  }
  async goToday () {
    this.setDate(U.toStamp(new Date()))
  }

  @observable pickingDate :string|void = undefined

  startPick () {
    this.pickingDate = this.currentDate
  }
  updatePick (stamp :string|void) {
    if (stamp) {
      this.pickingDate = stamp
      this.setDate(stamp)
    }
  }
  commitPick () {
    this.pickingDate = undefined
  }

  addEntry () {
    if (this.newEntry.length === 0 || !this.current) return
    const tags :string[] = []
    let text = popTags(this.newEntry, tags)
    this.current.addEntry(text, tags)
    this.newEntry = ""
  }

  //
  // History stuff

  @observable histYear :number = new Date().getFullYear()
  get history () :DB.Annum {
    if (this._history === null || this._history.year !== this.histYear) {
      this._history = this.db.journalYear(this.histYear)
      this._historyEntCache.clear()
    }
    return this._history
  }
  private _history :DB.Annum|null = null
  private _historyEntCache :Map<string, Map<string, EntryStore>> = new Map()

  historyEntries (journum :M.Journum) :EntryStore[] {
    let cache = this._historyEntCache.get(journum.date)
    if (!cache) this._historyEntCache.set(journum.date, cache = new Map())
    return getCachedEntryStores(journum, cache)
  }

  rollHistYear (delta :number) {
    this.histYear = this.histYear + delta
  }

  @observable histFilterPend = ""
  @observable histFilter = ""

  setHistFilter (filter :string) {
    this.histFilterPend = filter
    setTimeout(() => this.applyHistFilter(), 500)
  }
  applyHistFilter () {
    this.histFilter = this.histFilterPend
  }

  @observable legacyData :string = ""

  importLegacy () {
    for (let data of JSON.parse(this.legacyData)) this.db.createJournal(data)
    this.legacyData = ""
  }
}

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

  startItem () {
    this.item.startedProp && this.item.startedProp.syncValue.set(U.toStamp(new Date()))
  }
  completeItem () {
    this.item.completed.syncValue.set(U.toStamp(new Date()))
  }
  uncompleteItem () {
    this.item.completed.syncValue.set(null)
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
// View models for to-x views

function storesFor (items :DB.Items) :ItemStore[] {
  let stores :ItemStore[] = []
  for (let item of items.sortedItems) {
    stores.push(new ItemStore(item))
  }
  return stores
}

type Partition = {
  title :string,
  stores :ItemStore[]
}

type LegacyData = {[field :string]: string}
type Data = {[field :string]: any}

export type ItemsMode = "current" | "history" | "bulk"

export abstract class ItemsStore {
  @observable mode :ItemsMode = "current"

  constructor (readonly coll :DB.ItemCollection) {
    this.items = coll.items()
    this.compItems = coll.recentCompleted()
  }

  // TODO: someone needs to call close?
  close () {
    this.items.close()
    this.compItems.close()
    this._history && this._history.close()
    this._bulkItems && this._bulkItems.close()
  }

  //
  // Current stuff

  @observable newItem = ""

  readonly items :DB.Items
  readonly compItems :DB.Items

  // TODO: revamp to be based on a backing map from id?
  @computed get itemStores () :ItemStore[] { return storesFor(this.items) }
  @computed get recentStores () :ItemStore[] { return storesFor(this.compItems) }

  abstract get title () :string
  get partitions () :Partition[] { return [{title: this.title, stores: this.itemStores}] }

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

  //
  // History stuff

  @observable histFilterPend = ""
  @observable histFilter = ""

  get historyStores () :ItemStore[] { return storesFor(this.history) }
  get history () :DB.Items {
    if (this._history === null) this._history = this.coll.completed()
    return this._history
  }
  private _history :DB.Items|null = null

  setHistFilter (filter :string) {
    this.histFilterPend = filter
    setTimeout(() => this.applyHistFilter(), 500)
  }
  applyHistFilter () {
    this.histFilter = this.histFilterPend
  }

  //
  // Bulk editing & import stuff

  @observable bulkYear :number|void = undefined

  get bulkItems () :DB.Items {
    if (this._bulkItems === null || this._bulkYear !== this.bulkYear) {
      this._bulkItems = this.coll.items(this._bulkYear = this.bulkYear)
    }
    return this._bulkItems
  }
  private _bulkYear :number|void = undefined
  private _bulkItems :DB.Items|null = null

  rollBulkYear (delta :number) {
    const thisYear = new Date().getFullYear()
    if (delta < 0 && !this.bulkYear) this.bulkYear = thisYear
    else {
      const wantYear = (this.bulkYear || thisYear) + delta
      this.bulkYear = wantYear > thisYear ? undefined : wantYear
    }
  }

  @observable legacyData :string = ""

  importLegacy () {
    for (let data of JSON.parse(this.legacyData)) this.coll.create(this.legacyItemData(data))
    this.legacyData = ""
  }

  protected legacyItemData (ldata :LegacyData) :Data {
    const tags :string[] = []
    let text = popTags(ldata.text, tags)
    const data = this.newItemData(text)
    if (tags.length > 0) data.tags = tags
    if (ldata.type) data.type = ldata.type
    if (ldata.platform) data.platform = ldata.platform
    if (ldata.link) data.link = ldata.link
    if (ldata.rating) data.rating = ldata.rating
    if (ldata.completed) data.completed = ldata.completed
    data.created = ldata.completed ? new Date(ldata.completed) : new Date()
    return data
  }

  protected abstract newItemData (text :string) :Data
}

export abstract class ProtractedItemsStore extends ItemsStore {

  abstract get startedTitle () :string

  get partitions () :Partition[] {
    const stores = this.itemStores
    const pending = (store :ItemStore) => (!store.item.startedProp ||
                                           store.item.startedProp.value === undefined)
    const parts = [{title: this.title, stores: stores.filter(pending)}]
    const started = stores.filter(store => !pending(store))
    if (started.length > 0) parts.unshift({title: this.startedTitle, stores: started})
    return parts
  }

  protected legacyItemData (ldata :LegacyData) :Data {
    const data = super.legacyItemData(ldata)
    if (data.completed) data.started = data.completed
    return data
  }
}

export class ToReadStore extends ProtractedItemsStore {
  get title () :string { return "To Read" }
  get startedTitle () :string { return "Reading" }
  constructor (db :DB.DB) { super(db.read) }

  protected newItemData (text :string) {
    const dashIdx = text.indexOf(" - ")
    if (dashIdx < 0) return {title: text, type: "book"}
    const [title, author] = text.split(" - ")
    return {title, author, type: "book"}
  }
}

export class ToWatchStore extends ItemsStore {
  get title () :string { return "To See" }
  constructor (db :DB.DB) { super(db.watch) }
  protected newItemData (text :string) {
    const dashIdx = text.indexOf(" - ")
    if (dashIdx < 0) return {title: text, type: "film"}
    const [title, director] = text.split(" - ")
    return {title, director, type: "film"}
  }
}

export class ToHearStore extends ItemsStore {
  get title () :string { return "To Hear" }
  constructor (db :DB.DB) { super(db.hear) }
  protected newItemData (text :string) { return {title: text, type: "song"} }
}

export class ToPlayStore extends ProtractedItemsStore {
  get title () :string { return "To Play" }
  get startedTitle () :string { return "Playing" }
  constructor (db :DB.DB) { super(db.play) }
  protected newItemData (text :string) { return {title: text, platform: "pc"} }
}

export class ToDineStore extends ItemsStore {
  get title () :string { return "To Dine" }
  constructor (db :DB.DB) { super(db.dine) }
  protected newItemData (text :string) { return {name: text} }
}

export class ToBuildStore extends ProtractedItemsStore {
  get title () :string { return "To Build" }
  get startedTitle () :string { return "Building" }
  constructor (db :DB.DB) { super(db.build) }
  protected newItemData (text :string) { return {text} }
}

//
// Top-level app

export class Stores {
  journal :JournalStore
  items :Map<M.ItemType, ItemsStore> = new Map()

  constructor (readonly db :DB.DB) {
    this.journal = new JournalStore(db)
  }

  storeFor (type :M.ItemType) {
    const store = this.items.get(type)
    if (store) return store
    const nstore = this._createStore(type)
    this.items.set(type, nstore)
    return nstore
  }

  close () {
    this.journal.close()
    for (let store of this.items.values()) store.close()
  }

  _createStore (type :M.ItemType) :ItemsStore {
    switch (type) {
    case  "read": return  new ToReadStore(this.db)
    case "watch": return  new ToWatchStore(this.db)
    case  "hear": return  new ToHearStore(this.db)
    case  "play": return  new ToPlayStore(this.db)
    case  "dine": return  new ToDineStore(this.db)
    case "build": return  new ToBuildStore(this.db)
    default: throw new Error(`Unknown item type: ${type}`)
    }
  }
}

export type Tab = "journal" | "read" | "watch" | "hear" | "play" | "dine" | "build" // "do"
export const TABS :Tab[] = [ "journal", "read", "watch", "hear", "play", "dine", "build" ]

export class AppStore {
  readonly db = new DB.DB()
  @observable user :firebase.User|null = null
  @observable tab :Tab = "journal"
  // TODO: persist pinned to browser local storage
  @observable pinned :Tab[] = []

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

  isPinned (tab :Tab) :boolean { return this.pinned.includes(tab) }

  pin (tab :Tab) {
    this.pinned.unshift(tab)
    for (let rtab of TABS) {
      if (!this.isPinned(rtab)) {
        this.tab = rtab
        break
      }
    }
  }

  unpin (tab :Tab) {
    let idx = this.pinned.indexOf(tab)
    if (idx >= 0) this.pinned.splice(idx, 1)
  }
}
