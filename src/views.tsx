import * as React from "react";
import { IObservableValue } from "mobx"
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
    const parts = store.partitions
    const partViews = parts.map(part =>
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
    const done = store.doneItemStores
    // TODO: add a year picker?
    if (done) {
      partViews.push(
        <UI.List key={store.doneTitle}>
          <UI.ListItem>
            <UI.Typography variant="h6" color="inherit">{store.doneTitle}</UI.Typography>
            {U.menuButton("prev", <Icons.ArrowLeft />, () => store.rollDoneYear(-1))}
            <UI.Typography variant="h6" color="inherit">{String(store.doneYear)}</UI.Typography>
            {U.menuButton("next", <Icons.ArrowRight />, () => store.rollDoneYear(1))}
          </UI.ListItem>
          {done.map(es => this.makeItemView(es))}
          {done.length == 0 ? <UI.ListItem><UI.Typography variant="subtitle1" />(empty)</UI.ListItem> : undefined}
        </UI.List>)
    }
    return partViews
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

const tagStyles = (theme :UI.Theme) => UI.createStyles({
  chip: {
    margin: theme.spacing.unit/2,
  }
})
interface TagProps extends UI.WithStyles<typeof tagStyles> {
  tag :string
}
class TagRaw extends React.Component<TagProps> {
  render () {
    return <UI.Chip label={this.props.tag} className={this.props.classes.chip} />
  }
}
const Tag = UI.withStyles(tagStyles)(TagRaw)

@observer
class ItemView extends React.Component<{store :S.ItemStore}> {

  render () {
    const store = this.props.store
    return (
      <UI.ListItem disableGutters>
        {this.makeCheckButton(store)}
        <UI.ListItemText primary={this.primaryText} secondary={this.secondaryText} />
        {store.item.tags.map(tag => <Tag key={tag} tag={tag} />)}
        {U.menuButton("edit", Icons.edit, () => store.startEdit())}
        {this.createEditDialog()}
     </UI.ListItem>
    )
  }

  protected get primaryText () :string { return "TODO" }
  protected get secondaryText () :string { return "" }

  protected makeCheckButton (store :S.ItemStore) :JSX.Element {
    return store.item.completed ?
      U.menuButton("check", Icons.checkedBox, () => store.uncompleteItem()) :
      U.menuButton("check", Icons.uncheckedBox, () => store.completeItem())
  }

  protected addDialogItems (items :JSX.Element[]) {}

  protected createEditDialog () :JSX.Element {
    return <ItemEditDialog store={this.props.store as S.ItemStore}
                           itemsFn={items => this.addDialogItems(items)} />
  }
}

function textEditor (label :string, prop :IObservableValue<string>, cells :UI.GridSize = 12) {
  return <UI.Grid key={label} item xs={cells}>
    <UI.TextField label={label} fullWidth value={prop.get()}
                  onChange={ev => prop.set(ev.currentTarget.value)} />
  </UI.Grid>
}

function dateEditor (label :string, prop :IObservableValue<string|void>,
                     cells :UI.GridSize = 6) :JSX.Element {
  return <UI.Grid key={label} item xs={cells}>
    <UI.TextField label={label} type="date" InputLabelProps={{shrink: true}}
                  value={prop.get() || ""}
                  onChange={ev => prop.set(ev.currentTarget.value || undefined)} />
  </UI.Grid>
}

function enumEditor (key :string, options :{value :string, label :string}[],
                     prop :IObservableValue<string>, cells :UI.GridSize = 6) {
  const id = `enum-${key}`
  return <UI.Grid key={key} item xs={cells}>
    <UI.FormControl>
      <UI.InputLabel htmlFor={id}>Type</UI.InputLabel>
        <UI.Select native inputProps={{name: 'type', id}} value={prop.get()}
                   onChange={ev => prop.set(ev.target.value)}>
          {options.map(({value, label}) => <option key={value} value={value}>{label}</option>)}
      </UI.Select>
    </UI.FormControl>
  </UI.Grid>
}

function boolEditor (label :string, prop :IObservableValue<boolean>, cells :UI.GridSize = 6) {
  const check = <UI.Checkbox checked={prop.get()} onChange={ev => prop.set(ev.target.checked)} />
  return <UI.Grid key={label} item xs={cells}>
    <UI.FormControlLabel control={check} label={label} />
  </UI.Grid>
}

function completedEditor (store :S.ItemStore, cells :UI.GridSize = 6) :JSX.Element {
  return <UI.Grid key="completed" item xs={cells}>
    <UI.TextField label="Completed" type="date" InputLabelProps={{shrink: true}}
                  value={store.editCompleted || ""}
                  onChange={ev => store.editCompleted = ev.currentTarget.value || null} />
  </UI.Grid>
}

const iedStyles = UI.createStyles({
  grow: {
    flexGrow: 1,
  },
})

interface IEDProps extends UI.WithStyles<typeof iedStyles> {
  store :S.ItemStore,
  itemsFn :(items :JSX.Element[]) => void
}

@observer
class ItemEditDialogRaw extends React.Component<IEDProps> {
  render () {
    const {store, classes} = this.props
    const fullScreen = (this.props as any).fullScreen // yay for bullshit CSS & type shenanigans
    const ditems :JSX.Element[] = []
    this.props.itemsFn(ditems)
    return (
      <UI.Dialog key="edit-dialog" aria-labelledby="edit-dialog-title"
                 fullWidth fullScreen={fullScreen}
                 open={store.editing} onClose={ev => store.cancelEdit()}>
        <UI.DialogTitle id="edit-dialog-title">Edit</UI.DialogTitle>
        <UI.DialogContent>
          <UI.Grid container spacing={24}>{ditems}</UI.Grid>
        </UI.DialogContent>
        <UI.DialogActions>
          <UI.IconButton onClick={ev => store.deleteItem()}>{Icons.trash}</UI.IconButton>
          <UI.Typography className={classes.grow} variant="h6"></UI.Typography>
          <UI.Button onClick={ev => store.cancelEdit()}>Cancel</UI.Button>
          <UI.Button onClick={ev => store.commitEdit()} color="primary">Update</UI.Button>
        </UI.DialogActions>
      </UI.Dialog>
    )
  }
}

const ItemEditDialog = UI.withStyles(iedStyles)(UI.withMobileDialog<IEDProps>()(ItemEditDialogRaw))

class ProtractedView extends ItemView {
  protected makeCheckButton (store :S.ItemStore) :JSX.Element {
    const pstore = store as S.ProtractedStore
    if (pstore.item.started) return super.makeCheckButton(store) // complete item button
    else return U.menuButton("start", Icons.start, () => pstore.startItem())
  }
}

class BuildView extends ProtractedView {
  get store () :S.BuildStore { return this.props.store as S.BuildStore }

  protected get primaryText () :string { return this.store.item.text }

  protected addDialogItems (items :JSX.Element[]) {
    const store = this.store as S.BuildStore
    items.push(textEditor("Text", store.editText.value))
    items.push(textEditor("Tags", store.editTags.value))
    items.push(dateEditor("Started", store.editStarted.value))
    items.push(completedEditor(store))
    super.addDialogItems(items)
  }
}

export class ToBuildViewRaw extends ToXViewRaw<M.Build> {
  makeItemView (store :S.ItemStore) :JSX.Element {
    return <BuildView key={store.key} store={store} />
  }
}
export const ToBuildView = UI.withStyles(jvStyles)(ToBuildViewRaw)

const ReadTypes = [{value: "article", label: "Article"},
                   {value: "book", label: "Book"},
                   {value: "paper", label: "Paper"}]

class ReadView extends ProtractedView {
  get store () :S.ReadStore { return this.props.store as S.ReadStore }
  protected get primaryText () :string { return this.store.item.title }
  protected get secondaryText () :string { return this.store.item.author }

  protected addDialogItems (items :JSX.Element[]) {
    const store = this.props.store as S.ReadStore
    items.push(textEditor("Title", store.editTitle.value))
    items.push(textEditor("Author", store.editAuthor.value))
    items.push(enumEditor("type", ReadTypes, store.editType.value))
    items.push(boolEditor("Abandoned", store.editAbandoned.value))
    items.push(textEditor("Tags", store.editTags.value))
    items.push(dateEditor("Started", store.editStarted.value))
    items.push(completedEditor(store))
    super.addDialogItems(items)
  }
}

export class ToReadViewRaw extends ToXViewRaw<M.Read> {
  makeItemView (store :S.ItemStore) :JSX.Element {
    return <ReadView key={store.key} store={store} />
  }
}
export const ToReadView = UI.withStyles(jvStyles)(ToReadViewRaw)
