import { observer } from "mobx-react"
import * as React from "react";

import * as firebase from "firebase"
import StyledFirebaseAuth from 'react-firebaseui/StyledFirebaseAuth'

import * as Icons from "./icons"
import * as UI from "./ui"
import * as M from "./model"
import * as S from "./stores"
import * as V from "./views"
import { menuButton } from "./util"

const authConfig = {
  signInFlow: 'redirect',
  signInOptions: [
    firebase.auth.GoogleAuthProvider.PROVIDER_ID,
    firebase.auth.EmailAuthProvider.PROVIDER_ID,
  ],
  callbacks: {
    signInSuccessWithAuthResult: () => false
  }
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
  },
  intro: {
    margin: spacing.unit * 2,
  },
})

class LoginViewRaw extends React.Component<UI.WithStyles<typeof lvStyles>> {
  render () {
    const classes = this.props.classes
    return (
      <div className={classes.content}>
        <UI.Grid container spacing={16}>
          <UI.Grid item xs={12} className={classes.intro}>
            <UI.Typography variant="overline">{IntroTitle}</UI.Typography>
            <UI.Typography variant="body1">{IntroText}</UI.Typography>
          </UI.Grid>
          <UI.Grid item xs={12}>
            <StyledFirebaseAuth uiConfig={authConfig} firebaseAuth={firebase.auth()}/>
          </UI.Grid>
        </UI.Grid>
      </div>
    )
  }
}
const LoginView = UI.withStyles(lvStyles)(LoginViewRaw)

function itemsView (stores :S.Stores, type :M.ItemType) :[JSX.Element, JSX.Element] {
  const store = stores.storeFor(type), ui = V.itemUI(type)
  return [<V.ItemsView store={store} ui={ui} />, <V.ItemsFooter store={store} ui={ui} />]
}

function contentView (tab :S.Tab, stores :S.Stores) :[JSX.Element, JSX.Element] {
  switch (tab) {
  case S.Tab.JOURNAL: return [<V.JournumView store={stores.journal} />,
                              <V.JournumFooter store={stores.journal} />]
  case S.Tab.HISTORY: return [<V.ItemHistoryView store={stores.history} />,
                              <V.ItemHistoryFooter store={stores.history} />]
  case    S.Tab.BULK: return [<V.BulkView store={stores.bulk} />,
                              <V.BulkFooter store={stores.bulk} />]
  case    S.Tab.READ: return itemsView(stores, M.ItemType.READ)
  case   S.Tab.WATCH: return itemsView(stores, M.ItemType.WATCH)
  case    S.Tab.HEAR: return itemsView(stores, M.ItemType.HEAR)
  case    S.Tab.PLAY: return itemsView(stores, M.ItemType.PLAY)
  case    S.Tab.DINE: return itemsView(stores, M.ItemType.DINE)
  case   S.Tab.BUILD: return itemsView(stores, M.ItemType.BUILD)
  default:            return [<div>TODO: handle {tab}</div>, <div>TODO</div>]
  }
}

const avStyles = (theme :UI.Theme) => UI.createStyles({
  root: {
    display: "flex",
    flexDirection: "column",
    flexGrow: 1,
    height: "100%",

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

@observer
export class AppViewRaw extends React.Component<AVProps> {

  render () {
    // we have to check user to ensure an observable depend, meh
    const {classes, store, width} = this.props, {user, stores} = store
    if (!user || !stores) return (
      <div className={classes.root}>
        <UI.AppBar position="fixed">
          <UI.Toolbar>
            <UI.Typography variant="h6" color="inherit">Input/Output</UI.Typography>
          </UI.Toolbar>
        </UI.AppBar>
        <main className={classes.content}><LoginView /></main>
      </div>
    )

    const [content, footer] = contentView(store.tab, stores)
    return (
      <div className={classes.root}>
        <UI.AppBar className={classes.appBar}>
          <UI.Toolbar>
            <UI.Typography style={{marginRight: 5}} variant="h6" color="inherit">I/O</UI.Typography>
            {menuButton("journal", Icons.journal, () => store.tab = S.Tab.JOURNAL)}
            {menuButton("read", Icons.book, () => store.tab = S.Tab.READ)}
            {menuButton("watch", Icons.movie, () => store.tab = S.Tab.WATCH)}
            {menuButton("hear", Icons.music, () => store.tab = S.Tab.HEAR)}
            {menuButton("play", Icons.play, () => store.tab = S.Tab.PLAY)}
            {menuButton("dine", Icons.food, () => store.tab = S.Tab.DINE)}
            {menuButton("build", Icons.build, () => store.tab = S.Tab.BUILD)}
            {menuButton("history", Icons.history, () => store.tab = S.Tab.HISTORY)}
            {width === "xs" ? undefined : menuButton("bulk", Icons.bulk, () => store.tab = S.Tab.BULK)}
            <UI.Typography className={classes.grow} variant="h6" color="inherit"></UI.Typography>
            <UI.IconButton color="inherit" onClick={() => firebase.auth().signOut()}>
              <Icons.CloudOff /></UI.IconButton>
          </UI.Toolbar>
        </UI.AppBar>
        <main className={classes.content}>{content}</main>
        <UI.AppBar position="fixed" color="secondary" className={classes.appBar}>
          {footer}
        </UI.AppBar>
      </div>
    )
  }
}
export const AppView = UI.withStyles(avStyles)(UI.withWidth()(AppViewRaw))

        // <UI.Grid container>
        // <UI.Grid item xs={4}>{content}</UI.Grid>
        // {stores && (<UI.Grid item xs={4}>{contentView(S.Tab.READ, stores)}</UI.Grid>)}
        // {stores && (<UI.Grid item xs={4}>{contentView(S.Tab.BUILD, stores)}</UI.Grid>)}
        // </UI.Grid>
