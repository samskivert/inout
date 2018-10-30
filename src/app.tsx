import { observable } from "mobx"
import { observer } from "mobx-react"
import * as React from "react";

import * as firebase from "firebase"
import StyledFirebaseAuth from 'react-firebaseui/StyledFirebaseAuth'

import * as Icons from "./icons"
import * as UI from "./ui"
import * as V from "./views"
import { menuButton } from "./util"
import { DB } from "./db"

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

class LoginViewX extends React.Component<UI.WithStyles<typeof lvStyles>> {
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
const LoginView = UI.withStyles(lvStyles)(LoginViewX)

class Stores {
  journal :V.JournumStore
  build :V.CurrentBuildablesStore

  constructor (db :DB) {
    this.journal = new V.JournumStore(db, new Date())
    this.build = new V.CurrentBuildablesStore(db)
  }

  close () {
    this.journal.close()
    this.build.close()
  }
}

enum Tab { JOURNAL, BUILD, READ, SEE, LISTEN, PLAY, EAT, DO }

export class AppStore {
  readonly db = new DB()
  @observable user :firebase.User|null = null
  @observable mode = Tab.JOURNAL
  // this can't be a @computed because of MobX tracking depends through a constructor into the
  // constructed object itself which is idiotic, but yay for magic
  stores :Stores|null = null

  constructor () {
    firebase.auth().onAuthStateChanged(user => {
      if (user) console.log(`User logged in: ${user.uid}`)
      else console.log('User logged out.')
      this.db.setUserId(user ? user.uid : "none")
      if (this.stores) this.stores.close()
      if (user) this.stores = new Stores(this.db)
      else this.stores = null
      this.user = user
    })
  }
}

const avStyles = (theme :UI.Theme) => UI.createStyles({
  root: {
    flexGrow: 1,
  },
  grow: {
    flexGrow: 1,
  },
  content: {
    marginTop: theme.mixins.toolbar.minHeight,
  }
})

interface AVProps extends UI.WithStyles<typeof avStyles> {
  store :AppStore
}

@observer
export class AppViewX extends React.Component<AVProps> {

  render () {
    // we have to check user to ensure an observable depend, meh
    const {classes, store} = this.props, {user, stores} = store

    const toolbar = (user && stores) ? (
      <UI.Toolbar>
        {menuButton(<Icons.CalendarToday />, () => store.mode = Tab.JOURNAL)}
        {menuButton(<Icons.Build />, () => store.mode = Tab.BUILD)}
        <UI.Typography className={classes.grow} variant="h6" color="inherit"></UI.Typography>
        <UI.IconButton color="inherit" onClick={() => firebase.auth().signOut()}>
          <Icons.CloudOff /></UI.IconButton>
      </UI.Toolbar>
    ) : (
      <UI.Toolbar>
        <UI.Typography variant="h6" color="inherit">Input/Output</UI.Typography>
      </UI.Toolbar>
    )
    const content = (user && stores) ? this.contentView(stores) : <LoginView />

    return (
      <div className={classes.root}>
        <UI.AppBar position="fixed">{toolbar}</UI.AppBar>
        <div className={classes.content}>{content}</div>
      </div>
    )
  }

  protected contentView (stores :Stores) :JSX.Element {
    const mode = this.props.store.mode
    switch (mode) {
    case Tab.JOURNAL: return <V.JournumView store={stores.journal} />
    case   Tab.BUILD: return <V.CurrentItemsView store={stores.build} />
    default:          return <div>TODO: handle {mode}</div>
    }
  }
}
export const AppView = UI.withStyles(avStyles)(AppViewX)
