import * as React from "react";
import { IObservableValue } from "mobx"
import { observer } from "mobx-react"

import * as Icons from './icons';
import * as M from "./model"
import * as S from "./stores"
import * as U from "./util"
import * as UI from './ui';

// ------------
// HTML helpers

function tableCell (contents :JSX.Element, width :string = "") :JSX.Element {
  const styles :any = {paddingLeft: 5, paddingRight: 5, paddingBottom: 10, borderBottom: "none"}
  if (width) styles.width = width
  return <UI.TableCell style={styles}>{contents}</UI.TableCell>
}

function textListItem (text :string, key :string|undefined = undefined) :JSX.Element {
  return <UI.ListItem key={key}><UI.ListItemText primary={text} /></UI.ListItem>
}

function cycleButton (options :Object, current :string,
                      setter :(value :string) => void) :JSX.Element {
  const keys = Object.keys(options)
  const curidx = keys.indexOf(current)
  return <UI.Button color="inherit" variant="outlined" onClick={
    ev => setter(keys[(curidx+1)%keys.length])}>{options[current]}</UI.Button>
}

function text (text :string, variant :UI.ThemeStyle = "h6") :JSX.Element {
  return <UI.Typography variant={variant} color="inherit">{text}</UI.Typography>
}

function footText (text :string) {
  const styles = {marginLeft: 8, marginRight: 8}
  return <UI.Typography style={styles} variant="h6" color="inherit">{text}</UI.Typography>
}

const spStyles = UI.createStyles({
  grow: {flexGrow: 1},
})
export const Spacer = UI.withStyles(spStyles)(({classes} :UI.WithStyles<typeof spStyles>) =>
  <UI.Typography className={classes.grow} variant="h6" color="inherit"></UI.Typography>)

const tagStyles = (theme :UI.Theme) => UI.createStyles({
  chip: {margin: theme.spacing.unit/2}
})
interface TagProps extends UI.WithStyles<typeof tagStyles> {
  tag :string
}
const Tag = UI.withStyles(tagStyles)(({tag, classes} :TagProps) =>
  <UI.Chip label={tag} className={classes.chip} />)

// ----------------
// Property editors

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

function gridOptTextEditor (label :string, prop :IObservableValue<string|void>,
                            cells :UI.GridSize = 12) {
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

function gridCompletedEditor (prop :IObservableValue<string|null>,
                              cells :UI.GridSize = 6) :JSX.Element {
  return <UI.Grid key="completed" item xs={cells}>{completedEditor(prop)}</UI.Grid>
}

function enumEditor (label :string, options :{value :string, label :string}[],
                     prop :IObservableValue<string>) {
  const id = `enum-${label}`
  return <UI.FormControl>
    <UI.InputLabel shrink htmlFor={id}>{label}</UI.InputLabel>
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

function boolEditor (label :string, prop :IObservableValue<boolean>) {
  const check = <UI.Checkbox checked={prop.get()} onChange={ev => prop.set(ev.target.checked)} />
  return <UI.FormControlLabel control={check} label={label} />
}

function gridBoolEditor (label :string, prop :IObservableValue<boolean>, cells :UI.GridSize = 6) {
  return <UI.Grid key={label} item xs={cells}>{boolEditor(label, prop)}</UI.Grid>
}

// ---------------------
// Snack (feedback) view

function snackView (store :S.SnackStore) :JSX.Element {
  const hide = () => store.showing = false
  const actions = [
    <UI.IconButton key="close" aria-label="Close" color="inherit"
                   onClick={hide}><Icons.Close /></UI.IconButton>,
  ]
  const undo = store.current.undo
  if (undo) actions.unshift(<UI.Button key="undo" color="secondary" size="small"
                                       onClick={() => { undo() ; hide() }}>UNDO</UI.Button>)
  return <UI.Snackbar key="feedback" anchorOrigin={{vertical: 'bottom', horizontal: 'left'}}
                      open={store.showing} autoHideDuration={6000}
                      onClose={(ev, r) => { if (r !== "clickaway") hide() }}
                      onExited={() => store.showNext()}
                      message={<span id="message-id">{store.current.message}</span>}
                      action={actions} />
}

// -------------
// Journal views

const evProps = (theme :UI.Theme) => UI.createStyles({
  tagEditor: {marginLeft: theme.spacing.unit},
})

interface EVProps extends UI.WithStyles<typeof evProps> {
  store :S.EntryStore
  scrollTo :boolean
}

@observer
class EntryViewRaw extends React.Component<EVProps> {

  domRef = React.createRef<HTMLDivElement>()

  render () {
    const {store, classes} = this.props
    const buttons :JSX.Element[] = [
      U.menuButton("menu", Icons.menu, () => store.showMenu = !store.showMenu)
    ]
    if (store.showMenu) this.addMenuButtons(buttons)
    const textProp = store.entry.text.editValue
    const tagsProp = store.entry.tags.editValue
    return (
      <UI.RootRef rootRef={this.domRef}>
        <UI.ListItem disableGutters>
          {buttons}
          {store.editing ?
            <UI.Input fullWidth autoFocus value={textProp.get()}
                      onChange={ev => textProp.set(ev.currentTarget.value)}
                      onKeyDown={ev => store.handleEdit(ev.key)} /> :
            <UI.ListItemText primary={store.entry.text.value}
                             onClick={ev => ev.shiftKey && store.startEdit()} />}
          {store.editing ?
            <UI.Input value={tagsProp.get() || ""} placeholder="Tags" className={classes.tagEditor}
                      onChange={ev => tagsProp.set(ev.currentTarget.value)}
                      onKeyDown={ev => store.handleEdit(ev.key)} /> :
           store.entry.tags.value.map(tag => <Tag key={tag} tag={tag} />)}
          {store.editing && U.menuButton("done", Icons.done, () => store.commitEdit())}
       </UI.ListItem>
      </UI.RootRef>
    )
  }

  componentDidMount () {
    const {scrollTo} = this.props
    if (scrollTo) {
      const root = this.domRef.current
      root && root.scrollIntoView({behavior: "smooth", block: "end", inline: "nearest"});
    }
  }

  protected addMenuButtons (buttons :JSX.Element[]) {
    const {store} = this.props
    buttons.push(U.menuButton("up", Icons.up, () => store.moveItem(-1)))
    buttons.push(U.menuButton("down", Icons.down, () => store.moveItem(1)))
    buttons.push(U.menuButton("edit", Icons.edit, () => store.startEdit()))
    buttons.push(U.menuButton("delete", Icons.trash, () => store.deleteItem()))
  }
}
const EntryView = UI.withStyles(evProps)(EntryViewRaw)

const jvStyles = (theme :UI.Theme) => UI.createStyles({
  white: {
    color: "white"
  },
  histYear: {
    color: "white",
    borderBottom: "1px solid white",
    marginLeft: 8,
  },
  footText: {
    marginLeft: theme.spacing.unit,
    flexGrow: 1,
    color: "white",
    borderBottom: "1px solid white"
  },
  dateButton: {
    textTransform: "none",
  },
})

interface JVProps extends UI.WithStyles<typeof jvStyles> {
  store :S.JournalStore
  wide :boolean
}

@observer
class JournalViewRaw extends React.Component<JVProps> {

  render () {
    const {store, classes} = this.props, journum = store.current, entries = store.entries
    switch (store.mode) {
    case "current":
      return <UI.List>
        <UI.ListItem disableGutters>
          {U.menuButton("today", <Icons.Today />, () => store.goToday())}
          {U.menuButton("prev", <Icons.ArrowLeft />, () => store.rollDate(-1))}
          {store.pickingDate ?
           <UI.TextField autoFocus color="inherit" type="date" value={store.pickingDate}
                         onChange={ev => store.updatePick(ev.currentTarget.value)}
                         onBlur={ev => store.commitPick()} /> :
           <UI.Button className={classes.dateButton} onClick={() => store.startPick()}>
             {text(U.formatDate(store.currentDate))}</UI.Button>}
          {U.menuButton("next", <Icons.ArrowRight />, () => store.rollDate(+1))}
          <Spacer />
        </UI.ListItem>
        {journum === undefined ? textListItem("Loading...") :
         entries.length === 0 ? textListItem("No entries...") :
         entries.map(es => <EntryView key={es.key} store={es}
                                      scrollTo={store.scrollToKey === es.key} />)}
      </UI.List>
    case "history":
      const dates :JSX.Element[] = []
      if (store.history.pending) dates.push(textListItem("Loading...", "loading"))
      else if (store.history.items.length === 0) dates.push(textListItem("No entries...", "none"))
      else {
          for (let jm of store.history.sortedItems) {
          const filter = M.makeFilter(store.histFilter)
          const filtered = jm.entries.filter(entry => entry.matches(filter))
          if (filtered.length > 0) {
            dates.push(<UI.ListItem key={jm.date} disableGutters>
              <UI.IconButton color="inherit" onClick={ev => {
                store.setDate(jm.date)
                store.mode = "current"
              }}><Icons.Today /></UI.IconButton>
              {text(U.formatDate(jm.date))}
            </UI.ListItem>)
            for (let entry of filtered) {
              dates.push(<UI.ListItem key={`${jm.date}:${entry.key}`}>
                <UI.ListItemText primary={entry.text.value} />
                {entry.tags.value.map(tag => <Tag key={tag} tag={tag} />)}
              </UI.ListItem>)
            }
          }
        }
        if (dates.length === 0) dates.push(
          textListItem(`No matches of '${store.histFilter}'`, "nomatch"))
      }
      return <UI.List>{dates}</UI.List>
    }
  }
}
export const JournalView = UI.withStyles(jvStyles)(JournalViewRaw)

const thisYear = new Date().getFullYear()
const histYears = Array.from(new Array(thisYear-2000)).map((v, ii) => thisYear-ii)

@observer
class JournalFooterRaw extends React.Component<JVProps> {

  render () {
    const {store, classes, wide} = this.props
    const loading = !store.current
    const modeSelect = cycleButton({"current": "Current", "history": "History"}, store.mode,
                                   mode => store.mode = mode as S.JournalMode)
    const snack = snackView(store.snacks)

    switch (store.mode) {
    case "current":
      return <UI.Toolbar>
        {snack}
        {modeSelect}
        <UI.Input type="text" className={classes.footText} placeholder="Journal Entry"
                  value={store.newEntry} disableUnderline={true}
                  onChange={ev => store.newEntry = ev.currentTarget.value}
                  onKeyPress={ev => { if (ev.key === "Enter") store.addEntry() }} />
        <UI.IconButton color="inherit" disabled={loading}
          onClick={() => store.addEntry()}><Icons.Add /></UI.IconButton>
      </UI.Toolbar>
    case "history":
      return <UI.Toolbar>
        {snack}
        {modeSelect}
        <UI.Select className={classes.histYear} classes={{icon: classes.white}} native
                   value={store.histYear}
                   onChange={ev => store.histYear = parseInt(ev.target.value)}>
          {histYears.map(year => <option key={year} value={year}>{year}</option>)}
        </UI.Select>
        <UI.Input type="text" className={classes.footText} placeholder="Filter"
                  value={store.histFilterPend} disableUnderline={true}
                  onChange={ev => store.setHistFilter(ev.currentTarget.value)}
                  onKeyPress={ev => { if (ev.key === "Enter") store.applyHistFilter() }} />
        {wide &&
         <UI.Input type="text" className={classes.footText} placeholder="Import"
                   value={store.legacyData} disableUnderline={true}
                   onChange={ev => store.legacyData = ev.currentTarget.value}
                   onKeyPress={ev => { if (ev.key === "Enter") store.importLegacy() }} />}
      </UI.Toolbar>
    }
  }
}
export const JournalFooter = UI.withStyles(jvStyles)(JournalFooterRaw)

// ---------
// Item view

function addSecondary (have :string|void, label :string, text :string|void) :string|void {
  if (!have && !text) return undefined
  else if (!have) return `(${label} ${text})`
  else if (!text) return have
  else return `${have} (${label} ${text})`
}

const RatingEmoji = ["😴", "🤮", "😒", "😐", "🙂","😍"]

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
        {this.badges()}
        {U.menuButton("edit", Icons.edit, () => store.startEdit())}
        {this.createEditDialog()}
     </UI.ListItem>
    )
  }

  protected badges () :JSX.Element[] {
    const typeIcon = this.typeIcon
    const rating = this.rating
    const badges :JSX.Element[] = []
    if (rating !== undefined) badges.push(
      <UI.Typography key="rating" variant="h6">{RatingEmoji[rating]}</UI.Typography>)
    if (typeIcon) badges.push(<UI.IconButton key="type">{typeIcon}</UI.IconButton>)
    return badges
  }

  // this should be abstract but making this class abstract breaks the @observer annotation and we
  // enter a world of incidental bullshit, yay
  protected get primaryText () :string { return "<missing>" }
  protected get secondaryText () :string|void { return undefined }

  protected tags () :string[] { return this.props.store.item.tags.value }

  protected makeCheckButton (store :S.ItemStore) :JSX.Element {
    if (store.item.completed.value)
      return U.menuButton("check", Icons.checkedBox, () => store.uncompleteItem())
    else if (!store.item.startedProp || store.item.startedProp.value)
      return U.menuButton("check", Icons.uncheckedBox, () => store.completeItem())
    else return U.menuButton("start", Icons.start, () => store.startItem())
  }

  protected get rating () :number|void { return undefined }
  protected get typeIcon () :JSX.Element|void { return undefined }

  protected addDialogItems (items :JSX.Element[]) {}

  protected createEditDialog () :JSX.Element {
    return <ItemEditDialog store={this.props.store as S.ItemStore}
                           itemsFn={items => this.addDialogItems(items)} />
  }
}

// ----------------
// Item edit dialog

interface IEDProps {
  store :S.ItemStore,
  itemsFn :(items :JSX.Element[]) => void
}

@observer
class ItemEditDialogRaw extends React.Component<IEDProps> {
  render () {
    const {store} = this.props
    const fullScreen = (this.props as any).fullScreen // yay for bullshit CSS & type shenanigans
    const ditems :JSX.Element[] = []
    this.props.itemsFn(ditems)
    ditems.push(<UI.Grid key="created" item xs={12}>
                  {text(`Created: ${store.item.created.toDate().toLocaleString()}`, "caption")}
                </UI.Grid>)
    return (
      <UI.Dialog key="edit-dialog" fullWidth fullScreen={fullScreen}
                 open={store.editing} onClose={ev => store.cancelEdit()}>
        <UI.DialogTitle id="edit-dialog-title">Edit</UI.DialogTitle>
        <UI.DialogContent>
          <UI.Grid container spacing={24}>{ditems}</UI.Grid>
        </UI.DialogContent>
        <UI.DialogActions>
          <UI.IconButton onClick={ev => store.deleteItem()}>{Icons.trash}</UI.IconButton>
          <Spacer />
          <UI.Button onClick={ev => store.cancelEdit()}>Cancel</UI.Button>
          <UI.Button onClick={ev => store.commitEdit()} color="primary">Update</UI.Button>
        </UI.DialogActions>
      </UI.Dialog>
    )
  }
}

const ItemEditDialog = UI.withMobileDialog<IEDProps>()(ItemEditDialogRaw)

const RatingTypes = [
  {value: "none",  label: "None"},
  {value: "bad",   label: RatingEmoji[1] + "Bad"},
  {value: "meh",   label: RatingEmoji[2] + "Meh"},
  {value: "ok",    label: RatingEmoji[3] + "OK"},
  {value: "good",  label: RatingEmoji[4] + "Good"},
  {value: "great", label: RatingEmoji[5] + "Great"}]

export type ItemUI = {
  addPlaceholder :string
  itemView :(store :S.ItemStore) => JSX.Element
  titleIcon :JSX.Element
  doneTitle :string
  bulkEditor :(item :M.Item) => JSX.Element
}

// ----
// BUILD

class BuildView extends ItemView {
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

const BuildUI :ItemUI = {
  addPlaceholder: "Thing",
  itemView: store => <BuildView key={store.key} store={store} />,
  titleIcon: Icons.build,
  doneTitle: "Built",
  bulkEditor: bulkBuildEditor
}

// ----
// READ

const ReadTypes = [{value: "article", label: "Article"},
                   {value: "book", label: "Book"},
                   {value: "paper", label: "Paper"}]

class ReadView extends ItemView {
  get item () :M.Read { return this.props.store.item as M.Read }
  protected get primaryText () :string { return this.item.title.value }
  protected get secondaryText () :string|void {
    return addSecondary(this.item.author.value, "via", this.item.recommender.value)
  }

  protected get rating () :number|void {
    const ridx = M.Ratings.indexOf(this.item.rating.value)
    return this.item.abandoned.value ? 0 : (ridx == 0 ? undefined : ridx)
  }

  protected get typeIcon () :JSX.Element|void {
    switch (this.item.type.value) {
    case "article": return Icons.article
    case "book": return Icons.book
    case "paper": return Icons.paper
    }
  }

  protected addDialogItems (items :JSX.Element[]) {
    const item = this.item
    items.push(gridTextEditor("Title", item.title.editValue))
    items.push(gridOptTextEditor("Author", item.author.editValue))
    items.push(gridEnumEditor("Type", ReadTypes, item.type.editValue))
    items.push(gridOptTextEditor("Tags", item.tags.editValue, 6))
    items.push(gridOptTextEditor("Link", item.link.editValue, 6))
    items.push(gridOptTextEditor("Recommender", item.recommender.editValue, 6))
    items.push(gridEnumEditor("Rating", RatingTypes, item.rating.editValue))
    items.push(gridBoolEditor("Abandoned", item.abandoned.editValue))
    items.push(gridDateEditor("Started", item.started.editValue))
    items.push(gridCompletedEditor(item.completed.editValue))
    super.addDialogItems(items)
  }
}

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

const ReadUI :ItemUI = {
  addPlaceholder: "Title - Author",
  itemView: store => <ReadView key={store.key} store={store} />,
  titleIcon: Icons.book,
  doneTitle: "Read",
  bulkEditor: bulkReadEditor
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
  protected get secondaryText () :string|void {
    return addSecondary(this.item.director.value, "via", this.item.recommender.value)
  }

  protected get rating () :number|void {
    const ridx = M.Ratings.indexOf(this.item.rating.value)
    return (ridx == 0 ? undefined : ridx)
  }

  protected get typeIcon () :JSX.Element|void {
    switch (this.item.type.value) {
    case "show": return Icons.tv
    case "film": return Icons.movie
    case "video": return Icons.video
    case "other": return undefined
    }
  }

  protected addDialogItems (items :JSX.Element[]) {
    const item = this.item
    items.push(gridTextEditor("Title", item.title.editValue))
    items.push(gridOptTextEditor("Director", item.director.editValue))
    items.push(gridEnumEditor("Type", WatchTypes, item.type.editValue))
    items.push(gridOptTextEditor("Tags", item.tags.editValue, 6))
    items.push(gridOptTextEditor("Link", item.link.editValue, 6))
    items.push(gridOptTextEditor("Recommender", item.recommender.editValue, 6))
    items.push(gridEnumEditor("Rating", RatingTypes, item.rating.editValue))
    if (item.isEditProtracted) {
      items.push(gridBoolEditor("Abandoned", item.abandoned.editValue))
      items.push(gridDateEditor("Started", item.started.editValue))
    }
    items.push(gridCompletedEditor(item.completed.editValue))
    super.addDialogItems(items)
  }
}

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

const WatchUI :ItemUI = {
  addPlaceholder: "Title - Director",
  itemView: store => <WatchView key={store.key} store={store} />,
  titleIcon: Icons.movie,
  doneTitle: "Seen",
  bulkEditor: bulkWatchEditor
}

// ----
// HEAR

const HearTypes = [{value: "song", label: "Song"},
                   {value: "album", label: "Album"},
                   {value: "other", label: "Other"}]

class HearView extends ItemView {
  get item () :M.Hear { return this.props.store.item as M.Hear }
  protected get primaryText () :string { return this.item.title.value }
  protected get secondaryText () :string|void {
    return addSecondary(this.item.artist.value, "via", this.item.recommender.value)
  }

  protected get rating () :number|void {
    const ridx = M.Ratings.indexOf(this.item.rating.value)
    return (ridx == 0 ? undefined : ridx)
  }

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

const HearUI :ItemUI = {
  addPlaceholder: "Title - Artist",
  itemView: store => <HearView key={store.key} store={store} />,
  titleIcon: Icons.music,
  doneTitle: "Heard",
  bulkEditor: bulkHearEditor
}

// ----
// PLAY

const PlayTypes = [{value: "table",  label: "Table"},
                   {value: "pc",     label: "PC"},
                   {value: "mobile", label: "Mobile"},
                   {value: "switch", label: "Switch"},
                   {value: "ps4",    label: "PS4"},
                   {value: "xbox",   label: "XBOX"},
                   {value: "3ds",    label: "3DS"},
                   {value: "vita",   label: "PS Vita"},
                   {value: "wiiu",   label: "Wii U"},
                   {value: "ps3",    label: "PS3"},
                   {value: "wii",    label: "Wii"},
                   {value: "ps2",    label: "PS2"},
                   {value: "dcast",  label: "Dreamcast"},
                   {value: "cube",   label: "GameCube"},
                   {value: "gba",    label: "GBA"},
                   {value: "n64",    label: "N64"},
                   {value: "ps1",    label: "PS1"},
                   {value: "gbc",    label: "GameBoy Color"}]
const PlatformToName = new Map(PlayTypes.map(({value, label}) => [value, label] as [any, any]))

const SawCreditsEmoji = "🏁"

class PlayView extends ItemView {
  get item () :M.Play { return this.props.store.item as M.Play }
  protected get primaryText () :string { return this.item.title.value }
  protected get secondaryText () :string|void {
    return addSecondary(PlatformToName.get(this.item.platform.value),
                        "via", this.item.recommender.value)
  }

  protected get rating () :number|void {
    const ridx = M.Ratings.indexOf(this.item.rating.value)
    return (ridx == 0 ? undefined : ridx)
  }
  protected badges () :JSX.Element[] {
    const badges = super.badges()
    if (this.item.credits.value) badges.unshift(
      <UI.Typography key="credits" variant="h6">{SawCreditsEmoji}</UI.Typography>)
    return badges
  }

  protected addDialogItems (items :JSX.Element[]) {
    const item = this.item
    items.push(gridTextEditor("Title", item.title.editValue))
    items.push(gridEnumEditor("Platform", PlayTypes, item.platform.editValue))
    items.push(gridOptTextEditor("Tags", item.tags.editValue, 6))
    items.push(gridOptTextEditor("Link", item.link.editValue, 6))
    items.push(gridOptTextEditor("Recommender", item.recommender.editValue, 6))
    items.push(gridEnumEditor("Rating", RatingTypes, item.rating.editValue))
    items.push(gridBoolEditor("Saw Credits?", item.credits.editValue))
    items.push(gridDateEditor("Started", item.started.editValue))
    items.push(gridCompletedEditor(item.completed.editValue))
    super.addDialogItems(items)
  }
}

const PlayUI :ItemUI = {
  addPlaceholder: "Title",
  itemView: store => <PlayView key={store.key} store={store} />,
  titleIcon: Icons.play,
  doneTitle: "Played",
  bulkEditor: bulkPlayEditor
}

function bulkPlayEditor (item :M.Item) :JSX.Element {
  const play = item as M.Play
  return (
    <UI.TableRow key={item.ref.id}>
      {tableCell(textEditor("Title", play.title.syncValue))}
      {tableCell(enumEditor("Platform", PlayTypes, play.platform.syncValue), "100px")}
      {tableCell(boolEditor("Credits", play.credits.syncValue), "110px")}
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
  protected get secondaryText () :string|void {
    return addSecondary(this.item.location.value, "via", this.item.recommender.value)
  }

  protected get rating () :number|void {
    const ridx = M.Ratings.indexOf(this.item.rating.value)
    return (ridx == 0 ? undefined : ridx)
  }

  protected addDialogItems (items :JSX.Element[]) {
    const item = this.item
    items.push(gridTextEditor("Name", item.name.editValue))
    items.push(gridOptTextEditor("Location", item.location.editValue, 6))
    items.push(gridOptTextEditor("Tags", item.tags.editValue, 6))
    items.push(gridOptTextEditor("Link", item.link.editValue, 6))
    items.push(gridOptTextEditor("Recommender", item.recommender.editValue, 6))
    items.push(gridEnumEditor("Rating", RatingTypes, item.rating.editValue))
    items.push(gridCompletedEditor(item.completed.editValue))
    super.addDialogItems(items)
  }
}

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

const DineUI :ItemUI = {
  addPlaceholder: "Name",
  itemView: store => <DineView key={store.key} store={store} />,
  titleIcon: Icons.food,
  doneTitle: "Dined",
  bulkEditor: bulkDineEditor
}

// ----------
// Items view

export const itemUI = {
  "build": BuildUI,
  "read":  ReadUI,
  "watch": WatchUI,
  "hear":  HearUI,
  "play":  PlayUI,
  "dine":  DineUI,
}

const ivStyles = (theme :UI.Theme) => UI.createStyles({
  grow: {
    flexGrow: 1,
  },
  spacing: {
    unit: 4,
  },
  footText: {
    marginLeft: theme.spacing.unit,
    flexGrow: 1,
    color: "white",
    borderBottom: "1px solid white"
  },
})

interface IVProps extends UI.WithStyles<typeof ivStyles> {
  store :S.ItemsStore
  ui :ItemUI
  wide :boolean
}

type HistoryPartition = {year :string, stores :S.ItemStore[]}
function partitionByYear (stores :S.ItemStore[]) :HistoryPartition[] {
  const results :HistoryPartition[] = []
  let current :HistoryPartition|void = undefined
  for (let store of stores) {
    const compYear = store.item.completed.value || ""
    if (current === undefined || !compYear.startsWith(current.year)) {
      results.push(current = {year: compYear.substring(0, 4), stores: []})
    }
    current.stores.push(store)
  }
  return results
}

@observer
class ItemsViewRaw extends React.Component<IVProps> {

  render () {
    const {store, classes, ui} = this.props
    function listTitle (title :string) {
      return <UI.ListItem key={title} disableGutters>
        <UI.IconButton color="inherit">{ui.titleIcon}</UI.IconButton>
        <UI.Typography className={classes.grow} variant="h6" color="inherit">{title}</UI.Typography>
      </UI.ListItem>
    }
    const loadingItem = () =>
      <UI.ListItem key="loading"><UI.ListItemText primary="Loading..." /></UI.ListItem>
    const entries :JSX.Element[] = []
    switch (store.mode) {
    case "current":
      if (store.items.pending) {
        entries.push(listTitle(store.title))
        entries.push(loadingItem())
      } else {
        const parts = store.partitions
        for (let part of parts) {
          entries.push(listTitle(part.title))
          for (let store of part.stores) entries.push(ui.itemView(store))
        }
        entries.push(listTitle(`Recently ${ui.doneTitle}`))
        for (let es of store.recentStores) entries.push(ui.itemView(es))
      }
      break

    case "history":
      if (store.history.pending) {
        entries.push(loadingItem())
      } else {
        const filter = M.makeFilter(store.histFilter)
        const stores = store.historyStores.filter(item => item.item.matches(filter))
        if (stores.length == 0) {
          entries.push(listTitle(ui.doneTitle))
          const text = store.histFilter ? `nothing matches '${store.histFilter}'` : "nothing"
          entries.push(<UI.ListItem key="none"><UI.ListItemText primary={text} /></UI.ListItem>)
        } else for (let part of partitionByYear(stores)) {
          entries.push(listTitle(`${ui.doneTitle} - ${part.year}`))
          entries.push(...part.stores.map(ui.itemView))
        }
      }
      break

    case "bulk":
      return <div style={{padding: "15px 5px"}}>
        <UI.Table padding="none">
          <UI.TableBody>{store.bulkItems.items.map(ui.bulkEditor)}</UI.TableBody>
        </UI.Table>
      </div>
    }

    return <UI.List>{entries}</UI.List>
  }
}
export const ItemsView = UI.withStyles(ivStyles)(ItemsViewRaw)

@observer
class ItemsFooterRaw extends React.Component<IVProps> {

  render () {
    const {store, classes, ui, wide} = this.props
    const modeLabels = {"current": "Current", "history": "History"}
    if (wide) modeLabels["bulk"] = "Bulk"
    const modeSelect = cycleButton(modeLabels, store.mode, m => store.mode = m as S.ItemsMode)
    const snack = snackView(store.snacks)

    switch (store.mode) {
    case "current":
      return <UI.Toolbar>
        {snack}
        {modeSelect}
        <UI.Input className={classes.footText} placeholder={ui.addPlaceholder}
                  value={store.newItem} disabled={!store} disableUnderline={true}
                  onChange={ev => store.newItem = ev.currentTarget.value}
                  onKeyPress={ev => { if (ev.key === "Enter") this.addNewEntry() }} />
        <UI.IconButton color="inherit" disabled={!store}
          onClick={() => this.addNewEntry()}><Icons.Add /></UI.IconButton>
      </UI.Toolbar>
    case "history":
      return <UI.Toolbar>
        {snack}
        {modeSelect}
        <UI.Input placeholder="Filter" className={classes.footText} disabled={store.history.pending}
                  value={store.histFilterPend} disableUnderline={true}
                  onChange={ev => store.setHistFilter(ev.currentTarget.value)}
                  onKeyPress={ev => { if (ev.key === "Enter") store.applyHistFilter() }} />
      </UI.Toolbar>
    case "bulk":
      return <UI.Toolbar>
        {snack}
        {modeSelect}
        {footText("Year:")}
        {U.menuButton("prev", <Icons.ArrowLeft />, () => store.rollBulkYear(-1))}
        {text(String(store.bulkYear || "<new>"))}
        {U.menuButton("next", <Icons.ArrowRight />, () => store.rollBulkYear(1))}
        <Spacer />
        <UI.Input value={store.legacyData} className={classes.footText} disableUnderline={true}
                  placeholder="Import" onChange={ev => store.legacyData = ev.currentTarget.value} />
        <UI.Button color="inherit" onClick={ev => store.importLegacy()}>Submit</UI.Button>
      </UI.Toolbar>
    }
  }

  protected addNewEntry () {
    const store = this.props.store
    if (store.newItem.length === 0) return // TODO: ugh
    store.addItem(store.newItem)
    store.newItem = ""
  }
}
export const ItemsFooter = UI.withStyles(ivStyles)(ItemsFooterRaw)
