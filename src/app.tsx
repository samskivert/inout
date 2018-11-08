import { observer } from "mobx-react"
import * as React from "react";

import * as firebase from "firebase/app"
import "firebase/auth"
import StyledFirebaseAuth from 'react-firebaseui/StyledFirebaseAuth'

import * as Icons from "./icons"
import * as UI from "./ui"
import * as S from "./stores"
import * as V from "./views"
import { menuButton } from "./util"

const authConfig = {
  signInFlow: 'redirect',
  signInOptions: [
    firebase.auth.GoogleAuthProvider.PROVIDER_ID,
    firebase.auth.FacebookAuthProvider.PROVIDER_ID,
    firebase.auth.EmailAuthProvider.PROVIDER_ID,
  ],
  callbacks: {
    signInSuccessWithAuthResult: () => false
  },
};

const IntroTitle =
  "Welcome to Input/Output"

const IntroText =
  "An app for tracking the things that go into, and come out of your head. We need some way " +
  "to differentiate your head from all the other heads in the world. Please use one of the " +
  "following providers of a unique identifier that we can use for that purpose and that " +
  "purpose only."

const lvStyles = ({ palette, spacing }: UI.Theme) => UI.createStyles({
  root: {
    flexGrow: 1,
  },
  content: {
    maxWidth: 600,
    margin: spacing.unit * 2,
  },
})

class LoginViewRaw extends React.Component<UI.WithStyles<typeof lvStyles>> {
  render () {
    const classes = this.props.classes
    return (
      <div className={classes.content}>
        <UI.Grid container spacing={16}>
          <UI.Grid item xs={12}>
            <UI.Typography variant="overline">{IntroTitle}</UI.Typography>
            <UI.Typography variant="body1">{IntroText}</UI.Typography>
          </UI.Grid>
          <UI.Grid item xs={12}>
            <StyledFirebaseAuth uiConfig={authConfig} firebaseAuth={firebase.auth()}/>
          </UI.Grid>
          <UI.Grid item xs={12}>
            <UI.Typography variant="body1"><a href="privacy.html">Privacy policy</a></UI.Typography>
          </UI.Grid>
        </UI.Grid>
      </div>
    )
  }
}
const LoginView = UI.withStyles(lvStyles)(LoginViewRaw)

function contentView (store :S.AppStore, stores :S.Stores, width :string,
                      tab :S.Tab) :[JSX.Element, JSX.Element] {
  const wide = width !== "xs" && !store.isPinned(tab) && (store.pinned.length < 2)
  if (tab === "journal") return [<V.JournalView store={stores.journal} wide={wide}/>,
                                 <V.JournalFooter store={stores.journal} wide={wide} />]
  const type = tab
  const istore = stores.storeFor(type), ui = V.itemUI[type]
  return [<V.ItemsView store={istore} ui={ui} wide={wide}/>,
          <V.ItemsFooter store={istore} ui={ui} wide={wide} />]
}

const avStyles = (theme :UI.Theme) => UI.createStyles({
  panes: {
    display: "flex",
    flexDirection: "row",
    height: "100%",
  },
  section: {
    flex: "1 1 0",
    display: "flex",
    flexDirection: "column",
    flexGrow: 1,
    height: "100%",
    borderRight: "1px solid black",
  },
  grow: {
    flexGrow: 1,
  },
  content: {
    overflowY: "scroll",
    flex: "1 1 auto",
    "-webkit-overflow-scrolling": "touch",
  },
  appBar: {
    flex: "0 0 auto",
    position: "inherit",
  },
})

interface AVProps extends UI.WithStyles<typeof avStyles>, UI.WithWidth {
  store :S.AppStore
}

type TabData = {tab :S.Tab, title :string, icon :JSX.Element}
const TabInfo :TabData[] = [
  {tab: "journal", title: "Journal",  icon: Icons.journal},
  {tab: "read",    title: "To Read",  icon: Icons.book},
  {tab: "watch",   title: "To See",   icon: Icons.movie},
  {tab: "hear",    title: "To Hear",  icon: Icons.music},
  {tab: "play",    title: "To Play",  icon: Icons.play},
  {tab: "dine",    title: "To Dine",  icon: Icons.food},
  {tab: "build",   title: "To Build", icon: Icons.build},
]
function infoFor (tab :S.Tab) :TabData {
  for (let info of TabInfo) if (info.tab === tab) return info
  return TabInfo[0]
}

@observer
export class AppViewRaw extends React.Component<AVProps> {

  render () {
    // we have to check user to ensure an observable depend, meh
    const {classes, store, width} = this.props, {user, stores} = store
    if (!user || !stores) return (
      <div className={classes.section}>
        <UI.AppBar className={classes.appBar}>
          <UI.Toolbar>
            <UI.Typography variant="h6" color="inherit">Input/Output</UI.Typography>
          </UI.Toolbar>
        </UI.AppBar>
        <main className={classes.content}><LoginView /></main>
      </div>
    )

    function appView (stores :S.Stores, tab :S.Tab, toolbar :JSX.Element) :JSX.Element {
      const [content, footer] = contentView(store, stores, width, tab)
      return <div key={tab} className={classes.section}>
        <UI.AppBar className={classes.appBar}>{toolbar}</UI.AppBar>
        <main className={classes.content}>{content}</main>
        <UI.AppBar color="secondary" className={classes.appBar}>{footer}</UI.AppBar>
      </div>
    }
    function auxView (stores :S.Stores, info :TabData) :JSX.Element {
      const {tab, icon, title} = info, unpin = () => store.unpin(tab)
      const footer = <UI.Toolbar>
        <UI.IconButton color="inherit">{icon}</UI.IconButton>
        <UI.Typography style={{marginRight: 5}} variant="h6" color="inherit">{title}</UI.Typography>
        <V.Spacer />
        <UI.IconButton color="inherit" onClick={unpin}><Icons.Close /></UI.IconButton>
      </UI.Toolbar>
      return appView(stores, tab, footer)
    }

    const hideLogoff = () => store.showLogoff = false
    const logoff = () => { firebase.auth().signOut() ; hideLogoff() }
    const logoffDialog =
      <UI.Dialog open={store.showLogoff} onClose={hideLogoff} aria-labelledby="logoff-title">
        <UI.DialogTitle id="logoff-title">{"Sign out?"}</UI.DialogTitle>
        <UI.DialogActions>
          <UI.Button onClick={hideLogoff} color="primary">No</UI.Button>
          <UI.Button onClick={logoff} color="primary" autoFocus>Yes</UI.Button>
        </UI.DialogActions>
      </UI.Dialog>

    const mainToolbar = <UI.Toolbar>
      <UI.Typography style={{marginRight: 5}} variant="h6" color="inherit">I/O</UI.Typography>
      {TabInfo.filter(info => !store.isPinned(info.tab))
              .map(info => menuButton(info.tab, info.icon, () => store.tab = info.tab))}
      <V.Spacer />
      {width !== "xs" && menuButton("pin", Icons.pin, () => store.pin(store.tab))}
      {menuButton("logoff", <Icons.CloudOff />, () => store.showLogoff = true)}
      {logoffDialog}
    </UI.Toolbar>

    if (store.pinned.length > 0) return (
      <div className={classes.panes}>
      {appView(stores, store.tab, mainToolbar)}
      {store.pinned.map(tab => auxView(stores, infoFor(tab)))}
      </div>
    )
    else return appView(stores, store.tab, mainToolbar)
  }
}
export const AppView = UI.withStyles(avStyles)(UI.withWidth()(AppViewRaw))
