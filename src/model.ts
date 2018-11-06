import * as firebase from "firebase"
import { IObservableValue, observable, observe, computed, toJS } from "mobx"
import { Stamp, fromStamp } from "./util"

export type ID = string
export type URL = string

type Ref = firebase.firestore.DocumentReference
type Data = firebase.firestore.DocumentData
const DeleteValue = firebase.firestore.FieldValue.delete()

function assertDefined<T> (value :T|undefined) :T {
  if (value) return value
  throw new Error(`Illegal undefined value`)
}

function updateRef (ref :Ref, data :Data) {
  ref.update(data).
    then(() => console.log(`Yay, updated ${ref.id} (with ${JSON.stringify(data)})`)).
    catch(err => console.warn(`Failed to update ${ref.id}: ${err}`))
}

type PropKey = string|number|symbol

function isEmptyArray (value :any) :boolean {
  return Array.isArray(value) && value.length === 0
}

function syncRef (ref :Ref, prop :PropKey, refprop :PropKey, newValue :any) {
  console.log(`Syncing ${String(prop)} = '${newValue}' (to ${String(refprop)})`)
  const upValue = (newValue === undefined || isEmptyArray(newValue)) ? DeleteValue : newValue
  updateRef(ref, {[refprop]: upValue})
}

abstract class Prop<T> {
  get value () :T { return this.syncValue.get() }
  abstract get name () :string
  abstract get syncValue () :IObservableValue<T>
  abstract read (data :Data) :void
  abstract write (data :Data) :void
  abstract startEdit () :void
  abstract commitEdit () :void
}

function readProp (data :Data, prop :string) :any {
  const dotidx = prop.indexOf(".")
  if (dotidx == -1) return data[prop]
  else return readProp(data[prop.substring(0, dotidx)], prop.substring(dotidx+1))
}

function writeProp (data :Data, prop :string, value :any) {
  const dotidx = prop.indexOf(".")
  if (dotidx == -1) data[prop] = value
  else writeProp(data[prop.substring(0, dotidx)], prop.substring(dotidx+1), value)
}

class SimpleProp<T> extends Prop<T> {
  syncValue :IObservableValue<T>
  editValue :IObservableValue<T>

  constructor (readonly name :string, defval :T) {
    super()
    this.syncValue = observable.box(defval)
    this.editValue = observable.box(defval)
  }

  read (data :Data) {
    this.syncValue.set(readProp(data, this.name))
  }
  write (data :Data) {
    writeProp(data, this.name, this.value)
  }
  startEdit () {
    this.editValue.set(this.value)
  }
  commitEdit () {
    this.syncValue.set(this.editValue.get())
  }
}

function splitTags (text :string) :string[] {
  return text.split(" ").map(tag => tag.trim()).filter(tag => tag.length > 0)
}

class TagsProp extends Prop<string[]> {
  syncValue :IObservableValue<string[]> = observable.box([])
  editValue :IObservableValue<string> = observable.box("")

  constructor (readonly name :string = "tags") { super() }

  read (data :Data) {
    this.syncValue.set(readProp(data, this.name) || [])
  }
  write (data :Data) {
    writeProp(data, this.name, this.value)
  }
  startEdit () {
    this.editValue.set(this.value.join(" "))
  }
  commitEdit () {
    const tags = this.editValue.get()
    const newValue = tags ? splitTags(tags) : []
    // annoyingly setting a []-valued prop to [] triggers a reaction... ugh JavaScript
    if (!isEmptyArray(newValue) || !isEmptyArray(this.value)) this.syncValue.set(newValue)
  }
}

abstract class Doc {
  protected readonly props :Prop<any>[] = []
  protected _syncing = true

  constructor (readonly ref :Ref, data :Data) {}

  noteSync<T> (owner :T, prop :keyof T, refprop :PropKey = prop) {
    observe(owner, prop, change => {
      if (this._syncing) syncRef(this.ref, prop, refprop, change.newValue)
    })
    // TODO: may want to keep track of observers & allow removal/clearing?
  }

  read (data :Data) {
    this._syncing = false
    this.readProps(data)
    this._syncing = true
  }

  newProp<T> (name :string, defval :T) {
    return this.addProp(new SimpleProp(name, defval))
  }

  addProp<T,P extends Prop<T>> (prop :P) :P {
    prop.syncValue.observe(change => {
      if (this._syncing) syncRef(this.ref, prop.name, prop.name, change.newValue)
    })
    this.props.push(prop)
    return prop
  }

  removeProp<T> (prop :Prop<T>) {
    const idx = this.props.indexOf(prop)
    if (idx >= 0) this.props.splice(idx, 1)
  }

  startEdit () {
    for (let prop of this.props) prop.startEdit()
  }
  commitEdit () {
    for (let prop of this.props) prop.commitEdit()
  }

  protected readProps (data :Data) {
    for (let prop of this.props) prop.read(data)
  }
}

// Input model

export enum ItemType {
  READ = "read", WATCH = "watch", HEAR = "hear", PLAY = "play",
  DINE ="dine", BUILD = "build"/*, DO = "do"*/ }

function checkMatch (text :string|void, seek :string) {
  return text && text.toLowerCase().includes(seek)
}

export abstract class Item extends Doc {
  readonly created :firebase.firestore.Timestamp
  readonly tags = this.addProp(new TagsProp())
  readonly link = this.newProp<URL|void>("link", undefined)
  // we use null here (rather than undefined) because we need a null-valued property
  // in the database to enable queries for property == null (incomplete items)
  get startedProp () :Prop<Stamp|void>|void { return undefined }
  readonly completed = this.newProp<Stamp|null>("completed", null)

  constructor (ref :Ref, data :Data) {
    super(ref, data)
    this.created = data.created
  }

  matches (seek :string) {
    return (this.tags.value.some(tag => tag.toLowerCase() === seek) ||
            checkMatch(this.link.value, seek))
  }
}

export class Build extends Item {
  readonly text = this.newProp("text", "")
  readonly started = this.newProp<Stamp|void>("started", undefined)
  get startedProp () :Prop<Stamp|void>|void { return this.started }

  matches (text :string) {
    return super.matches(text) || checkMatch(this.text.value, text)
  }
}

export class Do extends Item {
  readonly text = this.newProp("text", "")
}

export type Rating = "none" | "bad" | "meh" | "ok" | "good" | "great"
export const Ratings = ["none", "bad", "meh", "ok", "good", "great"]

export abstract class Consume extends Item {
  readonly rating = this.newProp<Rating>("rating", "none")
  readonly recommender = this.newProp<string|void>("recommender", undefined)

  matches (text :string) {
    return super.matches(text) || checkMatch(this.recommender.value, text)
  }
}

export type ReadType = "article" | "book" | "paper"
export class Read extends Consume {
  readonly title = this.newProp("title", "")
  readonly author = this.newProp<string|void>("author", undefined)
  readonly type = this.newProp<ReadType>("type", "book")
  readonly started = this.newProp<Stamp|void>("started", undefined)
  get startedProp () :Prop<Stamp|void>|void { return this.started }
  readonly abandoned = this.newProp("abandoned", false)

  matches (text :string) {
    return (super.matches(text) ||
            checkMatch(this.title.value, text) ||
            checkMatch(this.author.value, text))
  }
}

export type WatchType = "show" | "film" | "video" | "other"
export class Watch extends Consume {
  readonly title = this.newProp("title", "")
  readonly director = this.newProp<string|void>("director", undefined)
  readonly type = this.newProp<WatchType>("type", "film")

  matches (text :string) {
    return (super.matches(text) ||
            checkMatch(this.title.value, text) ||
            checkMatch(this.director.value, text))
  }
}

export type HearType = "song" | "album" | "other"
export class Hear extends Consume {
  readonly title = this.newProp("title", "")
  readonly artist = this.newProp<string|void>("artist", undefined)
  readonly type = this.newProp<HearType>("type", "song")

  matches (text :string) {
    return (super.matches(text) ||
            checkMatch(this.title.value, text) ||
            checkMatch(this.artist.value, text))
  }
}

export type Platform = "pc" | "mobile" | "switch" | "ps4" | "xbox" | "3ds" | "vita" |
  "wiiu" | "ps3" | "wii" | "table"

export class Play extends Consume {
  readonly title = this.newProp("title", "")
  readonly platform = this.newProp<Platform>("platform", "pc")
  readonly started = this.newProp<Stamp|void>("started", undefined)
  get startedProp () :Prop<Stamp|void>|void { return this.started }
  // did we play through enough to see the credits?
  readonly credits = this.newProp("credits", false)

  matches (seek :string) {
    return (super.matches(seek) ||
            checkMatch(this.title.value, seek) ||
            checkMatch(this.platform.value, seek) ||
            (seek == "finished" && this.credits.value))
  }
}

export class Dine extends Consume {
  readonly name = this.newProp("name", "")
  readonly location = this.newProp<string|void>("location", undefined)

  matches (text :string) {
    return super.matches(text) || checkMatch(this.name.value, text)
  }
}

// Output model

export class Journum extends Doc {
  private _unsubscribe = () => {}

  readonly date :Stamp
  readonly midnight :number
  @observable order :string[] = []

  @computed get entries () :Entry[] {
    return this.order.map(key => assertDefined(this.entryMap.get(key)))
  }

  // TODO: aggregate all entry tags here, for queries by tag?

  readonly entryMap :Map<string,Entry> = new Map()

  constructor (ref :Ref, data :Data, live :boolean = true) {
    super(ref, data)
    this.date = data.date
    this.midnight = (fromStamp(this.date) || new Date()).getTime()
    if (live) {
      console.log(`Subscribing to doc: ${this.ref.id}`)
      this._unsubscribe = this.ref.onSnapshot(doc => {
        console.log(`Doc updated: ${this.ref.id}: ${JSON.stringify(doc.data())}`)
        this.read(doc.data() || {})
      })
    } else this.read(data)
    // `order` syncing is handled manually as we add/remove/move entries
  }

  // TODO: someone needs to call close!
  close () {
    this._unsubscribe()
  }

  protected readProps (data :Data) {
    // add and update entries
    const dataKeys = new Set(Object.keys(data.entries)), emap = this.entryMap
    for (let key of dataKeys) {
      let edata = data.entries[key]
      let entry = emap.get(key)
      if (!entry) emap.set(key, new Entry(this, key, edata))
    }

    // prune removed entries and sanitize `order`
    let order = ((data.order || []) as string[]).filter(key => emap.has(key))
    const okeys = new Set(order)
    for (let key of Array.from(emap.keys())) {
      if (!dataKeys.has(key)) {
        const oentry = emap.get(key)
        oentry && oentry.deleted()
        emap.delete(key)
      }
      else if (!okeys.has(key)) order.push(key)
    }

    // read our entry props
    super.readProps(data)

    // finally update order which will trigger a rebuild of our entries view
    this.order = order
  }

  addEntry (text :string, tags :string[]) {
    // we use seconds since midnight on this entry's date as a "mostly" unique key; since only one
    // user is likely to be adding to a journal, the only way they're likely to "conflict" with
    // themselves is by adding entries from device A, which is offline, then adding them from device
    // B which is online and later bringing device A online; since entry keys are picked based on
    // wall time, they're unlikely to conflict; note: if they add to future dates, they get negative
    // keys, whatevs!
    let secsSince = Math.round((new Date().getTime() - this.midnight)/1000)
    let key = String(secsSince)
    let edata = tags.length > 0 ? {text, tags} : {text}
    this.entryMap.set(key, new Entry(this, key, edata))
    this.order.push(key)
    updateRef(this.ref, {[`entries.${key}`]: edata, "order": toJS(this.order)})
  }

  deleteEntry (key :string) {
    const changes :Data = {}
    if (this.entryMap.delete(key)) {
      changes[`entries.${key}`] = DeleteValue
    }
    const oidx = this.order.indexOf(key)
    if (oidx >= 0) {
      this.order.splice(oidx, 1)
      changes["order"] = this.order
    }
    updateRef(this.ref, changes)
  }

  moveEntry (key :string, delta :number) {
    let opos = this.order.indexOf(key)
    if (opos >= 0) {
      let npos = Math.min(Math.max(opos+delta, 0), this.order.length-1)
      if (opos !== npos) {
        let norder = toJS(this.order)
        norder.splice(opos, 1)
        norder.splice(npos, 0, key)
        this.order = norder
        updateRef(this.ref, {"order": norder})
      }
    }
  }
}

export class Entry {
  readonly item :ID|void
  readonly text :SimpleProp<string>
  readonly tags :TagsProp

  constructor (readonly owner :Journum, readonly key :string, data :Data) {
    this.item = data.item
    this.text = owner.newProp(`entries.${key}.text`, "")
    this.tags = owner.addProp(new TagsProp(`entries.${key}.tags`))
  }

  startEdit () {
    this.text.startEdit()
    this.tags.startEdit()
  }
  commitEdit () {
    this.text.commitEdit()
    this.tags.commitEdit()
  }

  matches (seek :string) :boolean {
    return (this.text.value.toLowerCase().includes(seek) ||
            this.tags.value.some(tag => tag.toLowerCase() === seek))
  }

  deleted () {
    this.owner.removeProp(this.text)
    this.owner.removeProp(this.tags)
  }
}
