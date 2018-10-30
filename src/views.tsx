import * as React from "react";
import { observer } from "mobx-react"
import * as UI from './ui';
import * as Icons from './icons';
import * as M from "./model"
import * as S from "./stores"
import * as U from "./util"

const rvStyles = UI.createStyles({
  editor: {
    flexGrow: 1,
  },
})

interface RVProps extends UI.WithStyles<typeof rvStyles> {
  store :S.RowStore
}

@observer
class RowViewRaw extends React.Component<RVProps> {

  render () {
    const {store, classes} = this.props
    const editing = store.editText !== undefined
    const buttons :JSX.Element[] = [
      U.menuButton("menu", Icons.menu, () => store.showMenu = !store.showMenu)
    ]
    if (store.showMenu) {
      this.addMenuButtons(buttons)
      buttons.push(editing ? U.menuButton("cancel", Icons.cancel, () => store.cancelEdit()) :
                   U.menuButton("edit", Icons.edit, () => store.startEdit()))
    }
    return (
      <UI.ListItem disableGutters>
        {buttons}
        {store.editText === undefined ?
          <UI.ListItemText primary={store.getText()}
                        onClick={ev => ev.shiftKey && store.startEdit()} /> :
          <UI.Input autoFocus value={store.editText} className={classes.editor}
                 onChange={ev => store.editText = ev.currentTarget.value}
                 onKeyDown={ev => store.handleEdit(ev.key)} />}
        {editing && U.menuButton("done", Icons.done, () => store.commitEdit())}
     </UI.ListItem>
    )
  }

  protected addMenuButtons (buttons :JSX.Element[]) {
    const {store} = this.props
    buttons.push(U.menuButton("up", Icons.up, () => store.moveItem(-1)))
    buttons.push(U.menuButton("down", Icons.down, () => store.moveItem(1)))
    buttons.push(U.menuButton("delete", Icons.trash, () => store.deleteItem()))
  }
}
const RowView = UI.withStyles(rvStyles)(RowViewRaw)

const jvStyles = UI.createStyles({
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
class JournumViewRaw extends React.Component<JVProps> {

  render () {
    const {store, classes} = this.props, journum = store.current, entries = store.entries
    const haveJournum = journum !== undefined
    return (
      <UI.List>
        <UI.ListItem disableGutters>
          <UI.Typography className={classes.grow} variant="h6" color="inherit"></UI.Typography>
          {U.menuButton("today", <Icons.Today />, () => store.goToday())}
          {U.menuButton("prev", <Icons.ArrowLeft />, () => store.rollDate(-1))}
          <UI.Typography variant="h6" color="inherit">
            {U.formatDate(store.currentDate)}
          </UI.Typography>
          {U.menuButton("next", <Icons.ArrowRight />, () => store.rollDate(+1))}
          {store.pickingDate ?
          <UI.TextField autoFocus color="inherit" type="date" value={store.pickingDate}
            onChange={ev => store.updatePick(ev.currentTarget.value)}
            onBlur={ev => store.commitPick()} /> :
          U.menuButton("pick", <Icons.CalendarToday />, () => store.startPick())}
          <UI.Typography className={classes.grow} variant="h6" color="inherit"></UI.Typography>
        </UI.ListItem>
        {journum === undefined ? <UI.ListItem><UI.ListItemText primary="Loading..." /></UI.ListItem> :
         entries.length === 0 ? <UI.ListItem><UI.ListItemText primary="No entries..." /></UI.ListItem> :
         entries.map((es, ii) => <RowView key={ii} store={es} />)}
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
export const JournumView = UI.withStyles(jvStyles)(JournumViewRaw)

const txvStyles = UI.createStyles({
  grow: {
    flexGrow: 1,
  },
  spacing: {
    unit: 4,
  },
})

interface TXVProps<I extends M.Item> extends UI.WithStyles<typeof txvStyles> {
  store :S.ToXStore<I>
}

@observer
class ToXViewRaw<I extends M.Item> extends React.Component<TXVProps<I>> {

  render () {
    const {store, classes} = this.props
    if (store.items.pending) return (
      <UI.List>
        <UI.ListItem><UI.ListItemText primary="Loading..." /></UI.ListItem>
      </UI.List>
    )
    const parts = store.partitions()
    return parts.map(part =>
      <UI.List key={part.title}>
        <UI.ListItem>
          <UI.Typography className={classes.grow} variant="h6" color="inherit">
            {part.title}
          </UI.Typography>
        </UI.ListItem>
        {part.stores.map(es => this.makeRowView(es))}
        {part === parts[parts.length-1] ?
         <UI.ListItem>
           <UI.Input type="text" className={classes.grow} placeholder={`Add ${part.title}...`}
                     value={store.newItem}
                     onChange={ev => store.newItem = ev.currentTarget.value}
                     onKeyPress={ev => { if (ev.key === "Enter") this.addNewEntry() }} />
           <UI.IconButton color="inherit" aria-label="Menu"
             onClick={() => this.addNewEntry()}><Icons.Add /></UI.IconButton>
         </UI.ListItem> : undefined}
      </UI.List>
    )
  }

  addNewEntry () {
    const store = this.props.store
    if (store.newItem.length === 0) return // TODO: ugh
    store.addItem(store.newItem)
    store.newItem = ""
  }

  makeRowView (store :S.RowStore) :JSX.Element {
    return <RowView key={store.key} store={store} />
  }
}

// const ToXView = UI.withStyles(jvStyles)(ToXViewRaw)

class BuildRowViewRaw extends RowViewRaw {
  protected addMenuButtons (buttons :JSX.Element[]) {
    super.addMenuButtons(buttons)
    const store = this.props.store as S.BuildStore
    buttons.push(U.menuButton("start", Icons.start, () => store.item.started = new Date()))
  }
}
const BuildRowView = UI.withStyles(rvStyles)(BuildRowViewRaw)

export class ToBuildViewRaw extends ToXViewRaw<M.Build> {

  makeRowView (store :S.RowStore) :JSX.Element {
    return <BuildRowView key={store.key} store={store} />
  }
}

export const ToBuildView = UI.withStyles(jvStyles)(ToBuildViewRaw)
