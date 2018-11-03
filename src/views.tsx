import * as React from "react";
import { IObservableValue } from "mobx"
import { observer } from "mobx-react"
import * as UI from './ui';
import * as Icons from './icons';
import * as M from "./model"
import * as S from "./stores"
import * as U from "./util"
import * as DB from "./db"

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

interface TXVProps extends UI.WithStyles<typeof txvStyles> {
  store :S.ToXStore
}

@observer
class ItemsViewRaw extends React.Component<TXVProps> {

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
    const store = this.props.store, link = store.item.link.value
    // TODO: window.open is kinda lame, make the link a real link...
    return (
      <UI.ListItem disableGutters>
        {this.makeCheckButton(store)}
        <UI.ListItemText primary={this.primaryText} secondary={this.secondaryText || ""} />
        {this.tags().map(tag => <Tag key={tag} tag={tag} />)}
        {link ? U.menuButton("link", Icons.link, () => window.open(link)) : undefined}
        {U.menuButton("edit", Icons.edit, () => store.startEdit())}
        {this.createEditDialog()}
     </UI.ListItem>
    )
  }

  // this should be abstract but making this class abstract breaks the @observer annotation and we
  // enter a world of incidental bullshit, yay
  protected get primaryText () :string { return "<missing>" }
  protected get secondaryText () :string|void { return undefined }

  protected tags () :string[] { return this.props.store.item.tags.value }

  protected makeCheckButton (store :S.ItemStore) :JSX.Element {
    return store.item.completed.value ?
      U.menuButton("check", Icons.checkedBox, () => store.uncompleteItem()) :
      U.menuButton("check", Icons.uncheckedBox, () => store.completeItem())
  }

  protected addDialogItems (items :JSX.Element[]) {}

  protected createEditDialog () :JSX.Element {
    return <ItemEditDialog store={this.props.store as S.ItemStore}
                           itemsFn={items => this.addDialogItems(items)} />
  }
}

function textEditor (label :string, prop :IObservableValue<string>) {
  return <UI.TextField label={label} fullWidth value={prop.get()}
                       onChange={ev => prop.set(ev.currentTarget.value)} />
}
function gridTextEditor (label :string, prop :IObservableValue<string>, cells :UI.GridSize = 12) {
  return <UI.Grid key={label} item xs={cells}>{textEditor(label, prop)}</UI.Grid>
}

function optTextEditor (label :string, prop :IObservableValue<string|void>) {
  const onValue = (value :string|void) => prop.set(value ? value : undefined)
  return <UI.TextField label={label} fullWidth value={prop.get() || ""}
                       onChange={ev => onValue(ev.currentTarget.value)} />
}

function gridOptTextEditor (label :string, prop :IObservableValue<string|void>, cells :UI.GridSize = 12) {
  return <UI.Grid key={label} item xs={cells}>{optTextEditor(label, prop)}</UI.Grid>
}

function dateEditor (label :string, prop :IObservableValue<string|void>) :JSX.Element {
  return <UI.TextField label={label} type="date" InputLabelProps={{shrink: true}}
                       value={prop.get() || ""}
                       onChange={ev => prop.set(ev.currentTarget.value || undefined)} />
}

function gridDateEditor (label :string, prop :IObservableValue<string|void>,
                     cells :UI.GridSize = 6) :JSX.Element {
  return <UI.Grid key={label} item xs={cells}>{dateEditor(label, prop)}</UI.Grid>
}

function completedEditor (prop :IObservableValue<string|null>) :JSX.Element {
  return <UI.TextField label="Completed" type="date" InputLabelProps={{shrink: true}}
                       value={prop.get() || ""}
                       onChange={ev => prop.set(ev.currentTarget.value || null)} />
}

function gridCompletedEditor (prop :IObservableValue<string|null>, cells :UI.GridSize = 6) :JSX.Element {
  return <UI.Grid key="completed" item xs={cells}>{completedEditor(prop)}</UI.Grid>
}

function enumEditor (label :string, options :{value :string, label :string}[],
                     prop :IObservableValue<string>) {
  const id = `enum-${label}`
  return <UI.FormControl>
    <UI.InputLabel htmlFor={id}>{label}</UI.InputLabel>
    <UI.Select native inputProps={{name: 'type', id}} value={prop.get()}
               onChange={ev => prop.set(ev.target.value)}>
      {options.map(({value, label}) => <option key={value} value={value}>{label}</option>)}
    </UI.Select>
  </UI.FormControl>
}

function gridEnumEditor (label :string, options :{value :string, label :string}[],
                         prop :IObservableValue<string>, cells :UI.GridSize = 6) {
  return <UI.Grid key={label} item xs={cells}>{enumEditor(label, options, prop)}</UI.Grid>
}

function boolEditor (label :string, prop :IObservableValue<boolean>, cells :UI.GridSize = 6) {
  const check = <UI.Checkbox checked={prop.get()} onChange={ev => prop.set(ev.target.checked)} />
  return <UI.Grid key={label} item xs={cells}>
    <UI.FormControlLabel control={check} label={label} />
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
    const item = store.item as M.Protracted
    if (item.started.value) return super.makeCheckButton(store) // complete item button
    else return U.menuButton("start", Icons.start, () => store.startItem())
  }
}

const RatingTypes = [
  {value: "none", label: "None"},
  {value: "bad", label: "Bad"},
  {value: "meh", label: "Meh"},
  {value: "ok", label: "OK"},
  {value: "good", label: "Good"},
  {value: "great", label: "Great"}]

// --------------------
// Bulk viewing/editing

@observer
class BulkItemsView extends React.Component<{
  items :DB.Items
  formatter :(item :M.Item) => JSX.Element
}> {
  render () {
    const {items, formatter} = this.props
    return (
      <UI.Table padding="none">
        <UI.TableBody>
        {items.items.map(formatter)}
        </UI.TableBody>
      </UI.Table>
    )
  }
}

@observer
export class BulkView extends React.Component<{store :S.BulkStore}> {
  render () {
    const store = this.props.store
    const itemStore = store.stores.storeFor(store.type)
    return <div>
      <UI.Table padding="dense">
        <UI.TableBody><UI.TableRow>
          <UI.TableCell>
          <UI.FormControl>
            <UI.InputLabel htmlFor={"type"}>Type</UI.InputLabel>
            <UI.Select native inputProps={{name: 'type', id: "type"}} value={store.type}
              onChange={ev => store.type = ev.target.value as M.ItemType}>
              {Object.keys(M.ItemType).map(key => <option key={key} value={M.ItemType[key]}>{key}</option>)}
            </UI.Select>
          </UI.FormControl>
          </UI.TableCell>
          <UI.TableCell>
          <UI.TextField label="Import" fullWidth value={store.legacyData}
                        onChange={ev => store.legacyData = ev.currentTarget.value} />
          </UI.TableCell>
          <UI.TableCell>
          <UI.Button onClick={ev => {
            itemStore.importLegacy(store.legacyData)
            store.legacyData = ""
          }}>Submit</UI.Button>
          </UI.TableCell>
        </UI.TableRow></UI.TableBody>
      </UI.Table>
      <BulkItemsView items={store.items} formatter={bulkItemFormatter(store.type)} />
    </div>
  }
}

function tableCell (contents :JSX.Element, width :string = "") :JSX.Element {
  const styles :any = {paddingLeft: 5, paddingRight: 5}
  if (width) styles.width = width
  return <UI.TableCell style={styles}>{contents}</UI.TableCell>
}

function bulkItemFormatter (type :M.ItemType) :(item :M.Item) => JSX.Element {
  switch (type) {
  case M.ItemType.BUILD: return bulkBuildEditor
  case  M.ItemType.READ: return bulkReadEditor
  case M.ItemType.WATCH: return bulkWatchEditor
  case  M.ItemType.HEAR: return bulkHearEditor
  case  M.ItemType.PLAY: return bulkPlayEditor
  case  M.ItemType.DINE: return bulkDineEditor
  default: throw new Error(`TODO: ${type}`)
  }
}

// ----
// BUILD

class BuildView extends ProtractedView {
  get item () :M.Build { return this.props.store.item as M.Build }

  protected get primaryText () :string { return this.item.text.value }

  protected addDialogItems (items :JSX.Element[]) {
    const item = this.item
    items.push(gridTextEditor("Text", item.text.editValue))
    items.push(gridOptTextEditor("Tags", item.tags.editValue, 6))
    items.push(gridOptTextEditor("Link", item.link.editValue, 6))
    items.push(gridDateEditor("Started", item.started.editValue))
    items.push(gridCompletedEditor(item.completed.editValue))
    super.addDialogItems(items)
  }
}

export class ToBuildViewRaw extends ItemsViewRaw {
  makeItemView (store :S.ItemStore) :JSX.Element {
    return <BuildView key={store.key} store={store} />
  }
}
export const ToBuildView = UI.withStyles(jvStyles)(ToBuildViewRaw)

function bulkBuildEditor (item :M.Item) :JSX.Element {
  const build = item as M.Build
  return (
    <UI.TableRow key={item.ref.id}>
      {tableCell(textEditor("Text", build.text.syncValue), "40%")}
      {tableCell(optTextEditor("Link", build.link.syncValue))}
      {tableCell(dateEditor("Started", build.started.syncValue), "100px")}
      {tableCell(completedEditor(build.completed.syncValue), "100px")}
    </UI.TableRow>
  )
}

// ----
// READ

const ReadTypes = [{value: "article", label: "Article"},
                   {value: "book", label: "Book"},
                   {value: "paper", label: "Paper"}]

class ReadView extends ProtractedView {
  get item () :M.Read { return this.props.store.item as M.Read }
  protected get primaryText () :string { return this.item.title.value }
  protected get secondaryText () :string|void { return this.item.author.value }

  protected tags () :string[] {
    const tags = super.tags().slice(0)
    tags.push(this.item.type.value)
    return tags
  }

  protected addDialogItems (items :JSX.Element[]) {
    const item = this.item
    items.push(gridTextEditor("Title", item.title.editValue))
    items.push(gridOptTextEditor("Author", item.author.editValue))
    items.push(gridEnumEditor("Type", ReadTypes, item.type.editValue))
    items.push(boolEditor("Abandoned", item.abandoned.editValue))
    items.push(gridOptTextEditor("Tags", item.tags.editValue, 6))
    items.push(gridOptTextEditor("Link", item.link.editValue, 6))
    items.push(gridOptTextEditor("Recommender", item.recommender.editValue, 6))
    items.push(gridEnumEditor("Rating", RatingTypes, item.rating.editValue))
    items.push(gridDateEditor("Started", item.started.editValue))
    items.push(gridCompletedEditor(item.completed.editValue))
    super.addDialogItems(items)
  }
}

export class ToReadViewRaw extends ItemsViewRaw {
  makeItemView (store :S.ItemStore) :JSX.Element {
    return <ReadView key={store.key} store={store} />
  }
}
export const ToReadView = UI.withStyles(jvStyles)(ToReadViewRaw)

function bulkReadEditor (item :M.Item) :JSX.Element {
  const read = item as M.Read
  return (
    <UI.TableRow key={item.ref.id}>
      {tableCell(textEditor("Title", read.title.syncValue))}
      {tableCell(optTextEditor("Author", read.author.syncValue), "150px")}
      {tableCell(enumEditor("Type", ReadTypes, read.type.syncValue), "100px")}
      {tableCell(boolEditor("Abandoned", read.abandoned.syncValue), "110px")}
      {tableCell(optTextEditor("Link", read.link.syncValue), "200px")}
      {tableCell(optTextEditor("Recommender", read.recommender.syncValue), "120px")}
      {tableCell(enumEditor("Rating", RatingTypes, read.rating.syncValue), "80px")}
      {tableCell(dateEditor("Started", read.started.syncValue), "100px")}
      {tableCell(completedEditor(read.completed.syncValue), "100px")}
    </UI.TableRow>
  )
}

// ----
// WATCH

const WatchTypes = [{value: "show", label: "Show"},
                   {value: "film", label: "Film"},
                   {value: "video", label: "Video"},
                   {value: "other", label: "Other"}]

class WatchView extends ItemView {
  get item () :M.Watch { return this.props.store.item as M.Watch }
  protected get primaryText () :string { return this.item.title.value }
  protected get secondaryText () :string|void { return this.item.director.value }

  protected addDialogItems (items :JSX.Element[]) {
    const item = this.item
    items.push(gridTextEditor("Title", item.title.editValue))
    items.push(gridOptTextEditor("Director", item.director.editValue, 6))
    items.push(gridOptTextEditor("Recommender", item.recommender.editValue, 6))
    items.push(gridEnumEditor("Type", WatchTypes, item.type.editValue))
    items.push(gridOptTextEditor("Tags", item.tags.editValue, 6))
    items.push(gridOptTextEditor("Link", item.link.editValue))
    items.push(gridEnumEditor("Rating", RatingTypes, item.rating.editValue))
    items.push(gridCompletedEditor(item.completed.editValue))
    super.addDialogItems(items)
  }
}

export class ToWatchViewRaw extends ItemsViewRaw {
  makeItemView (store :S.ItemStore) :JSX.Element {
    return <WatchView key={store.key} store={store} />
  }
}
export const ToWatchView = UI.withStyles(jvStyles)(ToWatchViewRaw)

function bulkWatchEditor (item :M.Item) :JSX.Element {
  const watch = item as M.Watch
  return (
    <UI.TableRow key={item.ref.id}>
      {tableCell(textEditor("Title", watch.title.syncValue))}
      {tableCell(optTextEditor("Director", watch.director.syncValue))}
      {tableCell(enumEditor("Type", WatchTypes, watch.type.syncValue))}
      {tableCell(optTextEditor("Link", watch.link.syncValue))}
      {tableCell(optTextEditor("Recommender", watch.recommender.syncValue))}
      {tableCell(enumEditor("Rating", RatingTypes, watch.rating.syncValue))}
      {tableCell(completedEditor(watch.completed.syncValue), "100px")}
    </UI.TableRow>
  )
}

// ----
// HEAR

const HearTypes = [{value: "song", label: "Song"},
                   {value: "album", label: "Album"},
                   {value: "other", label: "Other"}]

class HearView extends ItemView {
  get item () :M.Hear { return this.props.store.item as M.Hear }
  protected get primaryText () :string { return this.item.title.value }
  protected get secondaryText () :string|void { return this.item.artist.value }

  protected addDialogItems (items :JSX.Element[]) {
    const item = this.item
    items.push(gridTextEditor("Title", item.title.editValue))
    items.push(gridOptTextEditor("Artist", item.artist.editValue))
    items.push(gridEnumEditor("Type", HearTypes, item.type.editValue))
    items.push(gridOptTextEditor("Tags", item.tags.editValue, 6))
    items.push(gridOptTextEditor("Link", item.link.editValue, 6))
    items.push(gridOptTextEditor("Recommender", item.recommender.editValue, 6))
    items.push(gridEnumEditor("Rating", RatingTypes, item.rating.editValue))
    items.push(gridCompletedEditor(item.completed.editValue))
    super.addDialogItems(items)
  }
}

export class ToHearViewRaw extends ItemsViewRaw {
  makeItemView (store :S.ItemStore) :JSX.Element {
    return <HearView key={store.key} store={store} />
  }
}
export const ToHearView = UI.withStyles(jvStyles)(ToHearViewRaw)

function bulkHearEditor (item :M.Item) :JSX.Element {
  const hear = item as M.Hear
  return (
    <UI.TableRow key={item.ref.id}>
      {tableCell(textEditor("Title", hear.title.syncValue))}
      {tableCell(optTextEditor("Artist", hear.artist.syncValue))}
      {tableCell(enumEditor("Type", HearTypes, hear.type.syncValue))}
      {tableCell(optTextEditor("Link", hear.link.syncValue))}
      {tableCell(optTextEditor("Recommender", hear.recommender.syncValue))}
      {tableCell(enumEditor("Rating", RatingTypes, hear.rating.syncValue))}
      {tableCell(completedEditor(hear.completed.syncValue), "100px")}
    </UI.TableRow>
  )
}

// ----
// PLAY

const PlayTypes = [{value: "pc",     label: "PC"},
                   {value: "mobile", label: "Mobile"},
                   {value: "switch", label: "Switch"},
                   {value: "ps4",    label: "PS4"},
                   {value: "xbox",   label: "XBOX"},
                   {value: "3ds",    label: "3DS"},
                   {value: "vita",   label: "PS Vita"},
                   {value: "wiiu",   label: "Wii U"},
                   {value: "ps3",    label: "PS3"},
                   {value: "wii",    label: "Wii"},
                   {value: "table",  label: "Table"}]
const PlatformToName = new Map(PlayTypes.map(({value, label}) => [value, label] as [any, any]))

class PlayView extends ProtractedView {
  get item () :M.Play { return this.props.store.item as M.Play }
  protected get primaryText () :string { return this.item.title.value }
  protected get secondaryText () :string { return PlatformToName.get(this.item.platform.value) || "" }

  protected addDialogItems (items :JSX.Element[]) {
    const item = this.item
    items.push(gridTextEditor("Title", item.title.editValue))
    items.push(gridEnumEditor("Platform", PlayTypes, item.platform.editValue))
    items.push(gridOptTextEditor("Recommender", item.recommender.editValue, 6))
    items.push(gridOptTextEditor("Tags", item.tags.editValue, 6))
    items.push(gridOptTextEditor("Link", item.link.editValue, 6))
    items.push(gridEnumEditor("Rating", RatingTypes, item.rating.editValue))
    items.push(boolEditor("Abandoned", item.abandoned.editValue))
    items.push(gridDateEditor("Started", item.started.editValue))
    items.push(gridCompletedEditor(item.completed.editValue))
    super.addDialogItems(items)
  }
}

export class ToPlayViewRaw extends ItemsViewRaw {
  makeItemView (store :S.ItemStore) :JSX.Element {
    return <PlayView key={store.key} store={store} />
  }
}
export const ToPlayView = UI.withStyles(jvStyles)(ToPlayViewRaw)

function bulkPlayEditor (item :M.Item) :JSX.Element {
  const play = item as M.Play
  return (
    <UI.TableRow key={item.ref.id}>
      {tableCell(textEditor("Title", play.title.syncValue))}
      {tableCell(enumEditor("Platform", PlayTypes, play.platform.syncValue), "100px")}
      {tableCell(boolEditor("Abandoned", play.abandoned.syncValue), "110px")}
      {tableCell(optTextEditor("Link", play.link.syncValue), "200px")}
      {tableCell(optTextEditor("Recommender", play.recommender.syncValue), "120px")}
      {tableCell(enumEditor("Rating", RatingTypes, play.rating.syncValue), "80px")}
      {tableCell(dateEditor("Started", play.started.syncValue), "100px")}
      {tableCell(completedEditor(play.completed.syncValue), "100px")}
    </UI.TableRow>
  )
}

// ----
// DINE

class DineView extends ItemView {
  get item () :M.Dine { return this.props.store.item as M.Dine }
  protected get primaryText () :string { return this.item.name.value }
  protected get secondaryText () :string|void { return this.item.location.value }

  protected addDialogItems (items :JSX.Element[]) {
    const item = this.item
    items.push(gridTextEditor("Name", item.name.editValue))
    items.push(gridOptTextEditor("Location", item.location.editValue))
    items.push(gridOptTextEditor("Tags", item.tags.editValue, 6))
    items.push(gridOptTextEditor("Link", item.link.editValue, 6))
    items.push(gridOptTextEditor("Recommender", item.recommender.editValue, 6))
    items.push(gridEnumEditor("Rating", RatingTypes, item.rating.editValue))
    items.push(gridCompletedEditor(item.completed.editValue))
    super.addDialogItems(items)
  }
}

export class ToDineViewRaw extends ItemsViewRaw {
  makeItemView (store :S.ItemStore) :JSX.Element {
    return <DineView key={store.key} store={store} />
  }
}
export const ToDineView = UI.withStyles(jvStyles)(ToDineViewRaw)

function bulkDineEditor (item :M.Item) :JSX.Element {
  const dine = item as M.Dine
  return (
    <UI.TableRow key={item.ref.id}>
      {tableCell(textEditor("Name", dine.name.syncValue))}
      {tableCell(optTextEditor("Location", dine.location.syncValue))}
      {tableCell(optTextEditor("Link", dine.link.syncValue))}
      {tableCell(optTextEditor("Recommender", dine.recommender.syncValue))}
      {tableCell(gridEnumEditor("Rating", RatingTypes, dine.rating.syncValue))}
      {tableCell(completedEditor(dine.completed.syncValue), "100px")}
    </UI.TableRow>
  )
}
