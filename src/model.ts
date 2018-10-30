import * as firebase from "firebase"
import { observable, observe, computed, toJS } from "mobx"

export type ID = string
export type URL = string

type Ref = firebase.firestore.DocumentReference
type Data = firebase.firestore.DocumentData

const pad = (value :number) => (value < 10) ? `0${value}` : `${value}`

export function toStamp (date :Date) :string {
  return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`
}

const stampRE = /^([0-9]+)-([0-9]+)-([0-9]+)$/

export function fromStamp (stamp :string) :Date|void {
  let comps = stampRE.exec(stamp)
  if (comps && comps.length === 4) {
    let year = parseInt(comps[1])
    let month = parseInt(comps[2])-1
    let day = parseInt(comps[3])
    return new Date(year, month, day)
  }
}

function updateRef (ref :Ref, data :Data) {
  ref.update(data).
    then(() => console.log(`Yay, updated ${ref.id} (with ${JSON.stringify(data)})`)).
    catch(err => console.warn(`Failed to update ${ref.id}: ${err}`))
}

abstract class Doc {
  private _syncing = true

  constructor (readonly ref :Ref, data :Data) {}

  noteSync<T> (owner :T, prop :keyof T, refprop :string|number|symbol = prop) {
    observe(owner, prop, change => {
      if (this._syncing) {
        console.log(`Syncing ${prop} = '${change.newValue}' (to ${String(refprop)})`)
        updateRef(this.ref, {[refprop]: change.newValue})
      }
    })
    // TODO: may want to keep track of observers & allow removal/clearing?
  }

  read (data :Data) {
    this._syncing = false
    this.readProps(data)
    this._syncing = true
  }

  protected abstract readProps (data :Data) :void
}

export class Tags {
  constructor (readonly data :Data) {}

  read (data :Data) {
  }

  contains (tag :string) :boolean {
    return (this.data.tags || []).includes(tag)
  }
  add (tag :string) {
    const tags = this.data.tags || []
    if (!tags.includes(tag)) {
      this.data.tags.push(tag)
      // TODO: save? write back?
    }
  }
  remove (tag :string) {
    const tags = this.data.tags || []
    let idx = tags.indexOf(tag)
    if (idx >= 0) {
      this.data.tags = tags.splice(idx, 1)
    }
  }
}

// Input model

export abstract class Item extends Doc {
  readonly created :Date
  readonly tags :Tags
  // we use null here (rather than undefined) because we need a null-valued property
  // in the database to enable queries for property == null (incomplete items)
  @observable completed :Data|null = null
  @observable link :URL|void = undefined

  // usually computed from other fields
  abstract get text () :string

  constructor (ref :Ref, data :Data) {
    super(ref, data)
    this.created = data.created
    this.tags = new Tags(data)
    this.noteSync(this, "completed")
    this.noteSync(this, "link")
  }

  protected readProps (data :Data) {
    this.completed = data.completed
    this.link = data.link
  }
}

export class Buildable extends Item {
  @observable text :string = ""
  @observable started :Date|void = undefined

  constructor (ref :Ref, data :Data) {
    super(ref, data)
    this.noteSync(this, "text")
    this.noteSync(this, "started")
  }

  protected readProps (data :Data) {
    super.readProps(data)
    this.text = data.text
    this.started = data.started
  }
}

export class Doable extends Item {
  @observable text :string = ""

  constructor (ref :Ref, data :Data) {
    super(ref, data)
    this.noteSync(this, "text")
  }

  protected readProps (data :Data) {
    super.readProps(data)
    this.text = data.text
  }
}

export enum Rating { BAD, MEH, OK, GOOD, GREAT }

export abstract class Consumable extends Item {
  @observable rating :Rating|void = undefined
  @observable recommender :string|void = undefined

  constructor (ref :Ref, data :Data) {
    super(ref, data)
    this.noteSync(this, "rating")
    this.noteSync(this, "recommender")
  }

  protected readProps (data :Data) {
    super.readProps(data)
    this.rating = data.rating
    this.recommender = data.recommender
  }
}

// export enum ReadableType { POST, PAPER, BOOK }
// export enum Outcome { ABANDONED, FINISHED }

// export interface Readable extends Consumable {
//   type :ReadableType
//   title :string
//   author :string
//   started :Date|void
//   outcome :Outcome|void
// }

// export interface Playable extends Consumable {
//   title :string
//   started :Date|void
//   outcome :Outcome|void
// }

// export enum ListenableType { SONG, ALBUM, OTHER }

// export interface Listenable extends Consumable {
//   type :ListenableType
//   title :string
//   artist :string
// }

// export enum SeeableType { SHOW, FILM, VIDEO, OTHER }

// export interface Seeable extends Consumable {
//   type :SeeableType
//   title :string
//   director :string|void
// }

// export interface Dineable extends Consumable {
//   name :string
//   location :string
// }

function assertDefined<T> (value :T|undefined) :T {
  if (value) return value
  throw new Error(`Illegal undefined value`)
}

// Output model

export class Journum extends Doc {
  private _unsubscribe = () => {}

  readonly date :Date
  @observable order :string[] = []

  @computed get entries () :Entry[] {
    return this.order.map(key => assertDefined(this.entryMap.get(key)))
  }

  // TODO: aggregate all entry tags here, for queries by tag?

  readonly entryMap :Map<string,Entry> = new Map()

  constructor (ref :Ref, data :Data) {
    super(ref, data)
    console.log(`Subscribing to doc: ${this.ref.id}`)
    this._unsubscribe = this.ref.onSnapshot(doc => {
      console.log(`Doc updated: ${this.ref.id}`)
      this.read(doc.data() || {})
    })

    const date = fromStamp(data.date)
    if (!date) throw new Error(`Invalid journum date: '${data.date}'`)
    this.date = date
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
      if (entry) entry.read(edata)
      else emap.set(key, new Entry(this, key, edata))
    }

    // prune removed entries and sanitize `order`
    let order = ((data.order || []) as string[]).filter(key => emap.has(key))
    const okeys = new Set(order)
    for (let key of Array.from(emap.keys())) {
      if (!dataKeys.has(key)) emap.delete(key)
      else if (!okeys.has(key)) order.push(key)
    }

    // finally update order which will trigger a rebuild of our entries view
    this.order = order
  }

  addEntry (text :string) {
    // we use seconds since midnight on this entry's date as a "mostly" unique key; since only one
    // user is likely to be adding to a journal, the only way they're likely to "conflict" with
    // themselves is by adding entries from device A, which is offline, then adding them from device
    // B which is online and later bringing device A online; since entry keys are picked based on
    // wall time, they're unlikely to conflict; note: if they add to future dates, they get negative
    // keys, whatevs!
    let secsSince = Math.round((new Date().getTime() - this.date.getTime())/1000)
    let key = String(secsSince)
    let edata = {text}
    this.entryMap.set(key, new Entry(this, key, edata))
    this.order.push(key)
    updateRef(this.ref, {[`entries.${key}`]: edata, "order": toJS(this.order)})
  }

  deleteEntry (key :string) {
    const changes :Data = {}
    if (this.entryMap.delete(key)) {
      changes[`entries.${key}`] = firebase.firestore.FieldValue.delete()
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
  readonly tags :Tags
  @observable text :string = ""

  constructor (owner :Journum, readonly key :string, data :Data) {
    this.item = data.item
    this.tags = new Tags(data)
    this.read(data)
    owner.noteSync(this, "text", `entries.${key}.text`)
  }

  read (data :Data) {
    this.text = data.text
  }
}
