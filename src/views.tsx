import * as React from "react";
import { computed, observable } from "mobx"
import { observer } from "mobx-react"
import {
  AppBar, IconButton, Input, List, ListItem, ListItemText, TextField, Toolbar, Typography,
  WithStyles, createStyles, withStyles
} from '@material-ui/core';
import * as Icons from '@material-ui/icons';
import * as firebase from "firebase"
import { DB } from "./db"
import * as M from "./model"

const dateFmtOpts = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' };
function formatDate (date :Date) :string {
  const locale = "en-US" // TODO: use browser locale?
  return date.toLocaleDateString(locale, dateFmtOpts)
}

class EntryStore {
  @observable editText :string|void = undefined
  @observable showMenu = false

  constructor (readonly journum :M.Journum, readonly entry :M.Entry) {}

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
  moveEntry (delta :number) {
    this.journum.moveEntry(this.entry.key, delta)
  }

  deleteEntry () {
    this.journum.deleteEntry(this.entry.key)
  }
}

const evStyles = createStyles({
  root: {
    flexGrow: 1,
  },
  editor: {
    flexGrow: 1,
  },
})

interface EVProps extends WithStyles<typeof evStyles> {
  store :EntryStore
}

function menuButton (icon :JSX.Element, onClick :() => void) :JSX.Element {
  return <IconButton color="inherit" aria-label="Menu" onClick={onClick}>{icon}</IconButton>
}

const menuIcon = <Icons.Adjust fontSize="inherit" />
const doneIcon = <Icons.Done fontSize="inherit" />
const cancelIcon = <Icons.Cancel fontSize="inherit" />
const editIcon = <Icons.Edit fontSize="inherit" />
const deleteIcon = <Icons.Delete fontSize="inherit" />
const upIcon = <Icons.ArrowUpward fontSize="inherit" />
const downIcon = <Icons.ArrowDownward fontSize="inherit" />

@observer
class EntryViewX extends React.Component<EVProps> {

  render () {
    const {store, classes} = this.props
    const editing = store.editText !== undefined
    return (
      <ListItem disableGutters>
        {menuButton(menuIcon, () => store.showMenu = !store.showMenu)}
        {store.showMenu && menuButton(upIcon, () => store.moveEntry(-1))}
        {store.showMenu && menuButton(downIcon, () => store.moveEntry(1))}
        {store.showMenu && menuButton(deleteIcon, () => store.deleteEntry())}
        {store.showMenu && !editing &&
         menuButton(editIcon, () => store.startEdit())}
        {store.editText === undefined ?
          <ListItemText primary={store.entry.text}
                        onClick={ev => ev.shiftKey && store.startEdit()} /> :
          <Input autoFocus value={store.editText} className={classes.editor}
                 onChange={ev => store.editText = ev.currentTarget.value}
                 onKeyDown={ev => store.handleEdit(ev.key)} />}
        {editing && menuButton(doneIcon, () => store.commitEdit())}
        {editing && menuButton(cancelIcon, () => store.cancelEdit())}
      </ListItem>
    )
  }
}
const EntryView = withStyles(evStyles)(EntryViewX)

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

  constructor (readonly db :DB, startDate :Date) {
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

const jvStyles = createStyles({
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

interface JVProps extends WithStyles<typeof jvStyles> {
  store :JournumStore
}

@observer
class JournumViewX extends React.Component<JVProps> {

  render () {
    const {store, classes} = this.props, journum = store.current, entries = store.entries
    const haveJournum = journum !== undefined
    return (
      <div className={classes.root}>
        <AppBar position="static">
          <Toolbar>
            {menuButton(<Icons.ArrowLeft />, () => store.rollDate(-1))}
            {menuButton(<Icons.Today />, () => store.goToday())}
            <Typography variant="h6" color="inherit">
              {formatDate(store.currentDate)}
            </Typography>
            {menuButton(<Icons.ArrowRight />, () => store.rollDate(+1))}
            {store.pickingDate ?
            <TextField autoFocus color="inherit" type="date" value={store.pickingDate}
              onChange={ev => store.updatePick(ev.currentTarget.value)}
              onBlur={ev => store.commitPick()} /> :
            menuButton(<Icons.CalendarToday />, () => store.startPick())}
            <Typography className={classes.grow} variant="h6" color="inherit"></Typography>
            <IconButton color="inherit" onClick={() => firebase.auth().signOut()}>
              <Icons.CloudOff /></IconButton>
          </Toolbar>
        </AppBar>
        <List>
          {journum === undefined ? <ListItem><ListItemText primary="Loading..." /></ListItem> :
           entries.length === 0 ? <ListItem><ListItemText primary="No entries..." /></ListItem> :
           entries.map((es, ii) => <EntryView key={ii} store={es} />)}
          <ListItem>
            <Input type="text" className={classes.grow} placeholder="Add entry..."
                   value={store.newEntry}
                   onChange={ev => store.newEntry = ev.currentTarget.value}
                   onKeyPress={ev => { if (ev.key === "Enter") this.addNewEntry() }} />
            <IconButton color="inherit" aria-label="Menu" disabled={!haveJournum}
              onClick={() => this.addNewEntry()}><Icons.Add /></IconButton>
          </ListItem>
        </List>
      </div>
    )
  }

  addNewEntry () {
    const store = this.props.store
    if (store.newEntry.length === 0 || !store.current) return // TODO: ugh
    store.current.addEntry(store.newEntry)
    store.newEntry = ""
  }
}
export const JournumView = withStyles(jvStyles)(JournumViewX)
