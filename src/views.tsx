import * as React from "react";
import { computed, observable } from "mobx"
import { observer } from "mobx-react"
import * as UI from './ui';
import * as Icons from './icons';
import * as DB from "./db"
import * as M from "./model"
import * as U from "./util"

const menuIcon = <Icons.Adjust fontSize="inherit" />
const doneIcon = <Icons.Done fontSize="inherit" />
const cancelIcon = <Icons.Cancel fontSize="inherit" />
const editIcon = <Icons.Edit fontSize="inherit" />
const deleteIcon = <Icons.Delete fontSize="inherit" />
const upIcon = <Icons.ArrowUpward fontSize="inherit" />
const downIcon = <Icons.ArrowDownward fontSize="inherit" />

abstract class ItemStore {
  @observable editText :string|void = undefined
  @observable showMenu = false

  abstract getText () :string
  abstract setText (text :string) :void
  abstract moveItem (delta :number) :void
  abstract deleteItem () :void

  startEdit () {
    this.editText = this.getText()
  }
  handleEdit (key :string) {
    if (key === "Escape") this.cancelEdit()
    else if (key === "Enter") this.commitEdit()
  }
  commitEdit () {
    if (this.editText) {
      this.setText(this.editText)
    }
    this.editText = undefined
  }
  cancelEdit () {
    this.editText = undefined
  }
}

const ivStyles = UI.createStyles({
  root: {
    flexGrow: 1,
  },
  editor: {
    flexGrow: 1,
  },
})

interface IVProps extends UI.WithStyles<typeof ivStyles> {
  store :ItemStore
}

@observer
class ItemViewX extends React.Component<IVProps> {

  render () {
    const {store, classes} = this.props
    const editing = store.editText !== undefined
    return (
      <UI.ListItem disableGutters>
        {U.menuButton(menuIcon, () => store.showMenu = !store.showMenu)}
        {store.showMenu && U.menuButton(upIcon, () => store.moveItem(-1))}
        {store.showMenu && U.menuButton(downIcon, () => store.moveItem(1))}
        {store.showMenu && U.menuButton(deleteIcon, () => store.deleteItem())}
        {store.showMenu && (editing ? U.menuButton(cancelIcon, () => store.cancelEdit()) :
                            U.menuButton(editIcon, () => store.startEdit()))}
        {store.editText === undefined ?
          <UI.ListItemText primary={store.getText()}
                        onClick={ev => ev.shiftKey && store.startEdit()} /> :
          <UI.Input autoFocus value={store.editText} className={classes.editor}
                 onChange={ev => store.editText = ev.currentTarget.value}
                 onKeyDown={ev => store.handleEdit(ev.key)} />}
        {editing && U.menuButton(doneIcon, () => store.commitEdit())}
     </UI.ListItem>
    )
  }
}
const ItemView = UI.withStyles(ivStyles)(ItemViewX)

class EntryStore extends ItemStore {

  constructor (readonly journum :M.Journum, readonly entry :M.Entry) { super() }

  getText () :string { return this.entry.text }
  setText (text :string) { this.entry.text = text }
  moveItem (delta :number) { this.journum.moveEntry(this.entry.key, delta) }
  deleteItem () { this.journum.deleteEntry(this.entry.key) }
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
    if (M.toStamp(date) !== M.toStamp(this.currentDate)) {
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
    this.pickingDate = M.toStamp(this.currentDate)
  }
  updatePick (stamp :string|void) {
    if (stamp) {
      this.pickingDate = stamp
      const date = M.fromStamp(stamp)
      date && this.setDate(date)
    }
  }
  commitPick () {
    this.pickingDate = undefined
  }
}

const jvStyles = UI.createStyles({
  root: {
    flexGrow: 1,
  },
  grow: {
    flexGrow: 1,
  },
  spacing: {
    unit: 4,
  },
})

interface JVProps extends UI.WithStyles<typeof jvStyles> {
  store :JournumStore
}

@observer
class JournumViewX extends React.Component<JVProps> {

  render () {
    const {store, classes} = this.props, journum = store.current, entries = store.entries
    const haveJournum = journum !== undefined
    return (
      <UI.List>
        <UI.ListItem disableGutters>
          {U.menuButton(<Icons.Today />, () => store.goToday())}
          {U.menuButton(<Icons.ArrowLeft />, () => store.rollDate(-1))}
          <UI.Typography variant="h6" color="inherit">
            {U.formatDate(store.currentDate)}
          </UI.Typography>
          {U.menuButton(<Icons.ArrowRight />, () => store.rollDate(+1))}
          {store.pickingDate ?
          <UI.TextField autoFocus color="inherit" type="date" value={store.pickingDate}
            onChange={ev => store.updatePick(ev.currentTarget.value)}
            onBlur={ev => store.commitPick()} /> :
          U.menuButton(<Icons.CalendarToday />, () => store.startPick())}
          <UI.Typography className={classes.grow} variant="h6" color="inherit"></UI.Typography>
        </UI.ListItem>
        {journum === undefined ? <UI.ListItem><UI.ListItemText primary="Loading..." /></UI.ListItem> :
         entries.length === 0 ? <UI.ListItem><UI.ListItemText primary="No entries..." /></UI.ListItem> :
         entries.map((es, ii) => <ItemView key={ii} store={es} />)}
        <UI.ListItem>
          <UI.Input type="text" className={classes.grow} placeholder="Add entry..."
                 value={store.newEntry}
                 onChange={ev => store.newEntry = ev.currentTarget.value}
                 onKeyPress={ev => { if (ev.key === "Enter") this.addNewEntry() }} />
          <UI.IconButton color="inherit" aria-label="Menu" disabled={!haveJournum}
            onClick={() => this.addNewEntry()}><Icons.Add /></UI.IconButton>
        </UI.ListItem>
      </UI.List>
    )
  }

  addNewEntry () {
    const store = this.props.store
    if (store.newEntry.length === 0 || !store.current) return // TODO: ugh
    store.current.addEntry(store.newEntry)
    store.newEntry = ""
  }
}
export const JournumView = UI.withStyles(jvStyles)(JournumViewX)

abstract class CurrentItemsStore<I extends M.Item> {
  readonly items :DB.Items<I>

  @observable newItem :string = ""

  @computed get itemStores () :ItemStore[] {
    let stores :ItemStore[] = []
    for (let item of this.items.items) {
      stores.push(this.newStore(item))
    }
    return stores
  }

  constructor (readonly coll :DB.ItemCollection<I>) {
    this.items = coll.items()
  }

  async addItem (text :string) {
    try {
      this.coll.create({text, completed: null})
    } catch (error) {
      console.warn(`Failed to create item (text: ${text})`)
      console.warn(error)
    }
  }

  // TODO: someone needs to call close!
  close () {
    this.items.close()
  }

  protected abstract newStore (item :I) :ItemStore
}

const civStyles = UI.createStyles({
  root: {
    flexGrow: 1,
  },
  grow: {
    flexGrow: 1,
  },
  spacing: {
    unit: 4,
  },
})

interface CIVProps<I extends M.Item> extends UI.WithStyles<typeof civStyles> {
  store :CurrentItemsStore<I>
}

@observer
class CurrentItemsViewX<I extends M.Item> extends React.Component<CIVProps<I>> {

  render () {
    const {store, classes} = this.props, items = store.items, stores = store.itemStores
    return <UI.List>
      {items.pending ? <UI.ListItem><UI.ListItemText primary="Loading..." /></UI.ListItem> :
       stores.map((es, ii) => <ItemView key={ii} store={es} />)}
      <UI.ListItem>
        <UI.Input type="text" className={classes.grow} placeholder="Add entry..."
               value={store.newItem}
               onChange={ev => store.newItem = ev.currentTarget.value}
               onKeyPress={ev => { if (ev.key === "Enter") this.addNewEntry() }} />
        <UI.IconButton color="inherit" aria-label="Menu"
          onClick={() => this.addNewEntry()}><Icons.Add /></UI.IconButton>
      </UI.ListItem>
    </UI.List>
  }

  addNewEntry () {
    const store = this.props.store
    if (store.newItem.length === 0) return // TODO: ugh
    store.addItem(store.newItem)
    store.newItem = ""
  }
}
export const CurrentItemsView = UI.withStyles(jvStyles)(CurrentItemsViewX)

class BuildableStore extends ItemStore {

  constructor (readonly build :M.Buildable) { super() }

  getText () :string { return this.build.text }
  setText (text :string) { this.build.text = text }
  moveItem (delta :number) { /*TODO*/ }
  deleteItem () {
    this.build.ref.delete().catch(error => {
      console.warn(`Failed to delete buildable: ${error}`)
      // TODO: feedback in UI
    })
  }
}

export class CurrentBuildablesStore extends CurrentItemsStore<M.Buildable> {

  constructor (db :DB.DB) {
    super(db.buildables)
  }

  protected newStore (item :M.Buildable) :ItemStore {
    return new BuildableStore(item)
  }
}
