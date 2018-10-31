import * as React from "react";
import { observer } from "mobx-react"
import * as UI from './ui';
import * as Icons from './icons';
import * as M from "./model"
import * as S from "./stores"
import * as U from "./util"

@observer
class EntryView extends React.Component<{store :S.EntryStore}> {

  render () {
    const store = this.props.store
    const editing = store.editText !== undefined
    const buttons :JSX.Element[] = [
      U.menuButton("menu", Icons.menu, () => store.showMenu = !store.showMenu)
    ]
    if (store.showMenu) {
      this.addMenuButtons(buttons)
    }
    return (
      <UI.ListItem disableGutters>
        {buttons}
        {store.editText === undefined ?
          <UI.ListItemText primary={store.entry.text}
                        onClick={ev => ev.shiftKey && store.startEdit()} /> :
          <UI.Input autoFocus value={store.editText} fullWidth
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
         entries.map((es, ii) => <EntryView key={ii} store={es} />)}
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
        {part.stores.map(es => this.makeItemView(es))}
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

  makeItemView (store :S.ItemStore) :JSX.Element {
    return <ItemView key={store.key} store={store} />
  }
}

@observer
class ItemView extends React.Component<{store :S.ItemStore}> {

  render () {
    const store = this.props.store
    return (
      <UI.ListItem disableGutters>
        {this.makeCheckButton(store)}
        <UI.ListItemText primary={store.item.text} />
        {this.createEditDialog()}
        {U.menuButton("edit", Icons.edit, () => store.startEdit())}
     </UI.ListItem>
    )
  }

  protected makeCheckButton (store :S.ItemStore) :JSX.Element {
    return U.menuButton("done", Icons.done, () => store.completeItem())
  }

  protected createEditDialog () :JSX.Element {
    return <ItemEditDialog store={this.props.store as S.ItemStore} />
  }
}

@observer
class ItemEditDialog extends React.Component<{store :S.ItemStore}> {

  render () {
    const store = this.props.store
    const ditems :JSX.Element[] = []
    this.addDialogItems(ditems)
    // completed always goes last...
    ditems.push(<UI.Grid key="completed" item xs>
      <UI.TextField label="Completed" type="date" InputLabelProps={{shrink: true}}
                    value={store.editCompleted || ""}
                    onChange={ev => store.editCompleted = ev.currentTarget.value || null} />
    </UI.Grid>)
    return (
      <UI.Dialog key="edit-dialog" aria-labelledby="edit-dialog-title" fullWidth
                 open={store.editing} onClose={ev => store.cancelEdit()}>
        <UI.DialogTitle id="edit-dialog-title">Edit</UI.DialogTitle>
        <UI.DialogContent>
          <UI.Grid container direction="column" spacing={8}>
            {ditems}
          </UI.Grid>
        </UI.DialogContent>
        <UI.DialogActions>
          <UI.Button onClick={ev => store.cancelEdit()} color="primary">Cancel</UI.Button>
          <UI.Button onClick={ev => store.commitEdit()} color="primary">Update</UI.Button>
        </UI.DialogActions>
      </UI.Dialog>
    )
  }

  protected addDialogItems (items :JSX.Element[]) {}
}

class ProtractedView extends ItemView {

  protected makeCheckButton (store :S.ItemStore) :JSX.Element {
    const pstore = store as S.ProtractedStore
    if (pstore.item.started) return super.makeCheckButton(store) // complete item button
    else return U.menuButton("start", Icons.start, () => pstore.startItem())
  }
}

class ProtractedEditDialog extends ItemEditDialog {

  protected addDialogItems (items :JSX.Element[]) {
    super.addDialogItems(items)
    const store = this.props.store as S.ProtractedStore
    items.push(<UI.Grid key="started" item xs>
      <UI.TextField label="Started" type="date" InputLabelProps={{shrink: true}}
                    value={store.editStarted || ""}
                    onChange={ev => store.editStarted = ev.currentTarget.value || undefined} />
    </UI.Grid>)
  }
}

class BuildEditDialog extends ProtractedEditDialog {

  protected addDialogItems (items :JSX.Element[]) {
    const store = this.props.store as S.BuildStore
    items.push(<UI.Grid key="text" item xs>
      <UI.TextField label="Text" fullWidth value={store.editText || ""}
                    onChange={ev => store.editText = ev.currentTarget.value} />
    </UI.Grid>)
    super.addDialogItems(items)
  }
}

class BuildView extends ProtractedView {

  protected createEditDialog () {
    return <BuildEditDialog store={this.props.store} />
  }
}

export class ToBuildViewRaw extends ToXViewRaw<M.Build> {

  makeItemView (store :S.ItemStore) :JSX.Element {
    return <BuildView key={store.key} store={store} />
  }
}

export const ToBuildView = UI.withStyles(jvStyles)(ToBuildViewRaw)
