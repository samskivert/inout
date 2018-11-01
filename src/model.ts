import * as firebase from "firebase"
import { observable, observe, computed, toJS } from "mobx"
import { Stamp, fromStamp } from "./util"

export type ID = string
export type URL = string

type Ref = firebase.firestore.DocumentReference
type Data = firebase.firestore.DocumentData

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
        const newValue = change.newValue === undefined ?
          firebase.firestore.FieldValue.delete() : change.newValue
        updateRef(this.ref, {[refprop]: newValue})
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

// Input model

export abstract class Item extends Doc {
  readonly created :firebase.firestore.Timestamp
  @observable tags :string[] = []
  // we use null here (rather than undefined) because we need a null-valued property
  // in the database to enable queries for property == null (incomplete items)
  @observable completed :Stamp|null = null
  @observable link :URL|void = undefined

  constructor (ref :Ref, data :Data) {
    super(ref, data)
    this.created = data.created
    this.noteSync(this, "completed")
    this.noteSync(this, "tags")
    this.noteSync(this, "link")
  }

  protected readProps (data :Data) {
    this.completed = data.completed
    this.tags = data.tags || []
    this.link = data.link
  }
}

export abstract class Protracted extends Item {
  @observable started :Stamp|void = undefined

  constructor (ref :Ref, data :Data) {
    super(ref, data)
    this.noteSync(this, "started")
  }

  protected readProps (data :Data) {
    super.readProps(data)
    this.started = data.started
  }
}

export class Build extends Protracted {
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

export class Do extends Item {
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

export abstract class Consume extends Item {
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

export type ReadType = "article" | "book" | "paper"

export class Read extends Protracted {
  @observable title = ""
  @observable author = ""
  @observable type = "book"
  @observable abandoned = false

  constructor (ref :Ref, data :Data) {
    super(ref, data)
    this.noteSync(this, "title")
    this.noteSync(this, "author")
    this.noteSync(this, "type")
    this.noteSync(this, "abandoned")
  }

  protected readProps (data :Data) {
    super.readProps(data)
    this.title = data.title
    this.author = data.author
    this.type = data.type
    this.abandoned = data.abandoned
  }
}

// export interface Play extends Consumable {
//   title :string
//   started :Stamp|void
//   outcome :Outcome|void
// }

// export enum ListenType { SONG, ALBUM, OTHER }

// export interface Listen extends Consumable {
//   type :ListenType
//   title :string
//   artist :string
// }

// export enum SeeType { SHOW, FILM, VIDEO, OTHER }

// export interface See extends Consumable {
//   type :SeeType
//   title :string
//   director :string|void
// }

// export interface Dine extends Consumable {
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
  readonly tags :string[]
  @observable text :string = ""

  constructor (owner :Journum, readonly key :string, data :Data) {
    this.item = data.item
    this.tags = data.tags || []
    this.read(data)
    owner.noteSync(this, "text", `entries.${key}.text`)
  }

  read (data :Data) {
    this.text = data.text
  }
}
