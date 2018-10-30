import * as React from "react";
import { observer } from "mobx-react"
import * as UI from './ui';
import * as Icons from './icons';
import * as M from "./model"
import * as S from "./stores"
import * as U from "./util"

const menuIcon = <Icons.Adjust fontSize="inherit" />
const doneIcon = <Icons.Done fontSize="inherit" />
const cancelIcon = <Icons.Cancel fontSize="inherit" />
const editIcon = <Icons.Edit fontSize="inherit" />
const deleteIcon = <Icons.Delete fontSize="inherit" />
const upIcon = <Icons.ArrowUpward fontSize="inherit" />
const downIcon = <Icons.ArrowDownward fontSize="inherit" />

const ivStyles = UI.createStyles({
  root: {
    flexGrow: 1,
  },
  editor: {
    flexGrow: 1,
  },
})

interface IVProps extends UI.WithStyles<typeof ivStyles> {
  store :S.ItemStore
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
  store :S.JournumStore
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
  store :S.CurrentItemsStore<I>
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
