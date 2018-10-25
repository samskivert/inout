import * as React from "react";
import * as ReactDOM from "react-dom";
import { observable } from "mobx"
import { observer } from "mobx-react"
import { AppBar, Grid, Theme, Toolbar, Typography } from '@material-ui/core';
import { WithStyles, createStyles, withStyles } from '@material-ui/core';

import * as firebase from "firebase"
import StyledFirebaseAuth from 'react-firebaseui/StyledFirebaseAuth'

import * as V from "./views"
import { DB } from "./db"

firebase.initializeApp({
  apiKey: "AIzaSyDy3Caew0ql16PM0x7laFXTcs6jih_-e8o",
  authDomain: "input-output-26476.firebaseapp.com",
  projectId: "input-output-26476",
})

const authConfig = {
  signInFlow: 'popup',
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

const lvStyles = ({ palette, spacing }: Theme) => createStyles({
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

class LoginViewX extends React.Component<WithStyles<typeof lvStyles>> {
  render () {
    const classes = this.props.classes
    return <div className={classes.root}>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" color="inherit">Input/Output</Typography>
        </Toolbar>
      </AppBar>
      <div className={classes.content}>
        <Grid container spacing={16}>
          <Grid item xs={12} className={classes.intro}>
            <Typography variant="overline">{IntroTitle}</Typography>
            <Typography variant="body1">{IntroText}</Typography>
          </Grid>
          <Grid item xs={12}>
            <StyledFirebaseAuth uiConfig={authConfig} firebaseAuth={firebase.auth()}/>
          </Grid>
        </Grid>
      </div>
    </div>
  }
}
const LoginView = withStyles(lvStyles)(LoginViewX)

class AppStore {
  readonly db = new DB()
  @observable user :firebase.User|null = null
  // this can't be a @computed because of MobX tracking depends through a constructor into the
  // constructed object itself which is idiotic, but yay for magic
  jstore :V.JournumStore|null = null

  constructor () {
    firebase.auth().onAuthStateChanged(user => {
      if (user) console.log(`User logged in: ${user.uid}`)
      else console.log('User logged out.')
      this.db.setUserId(user ? user.uid : "none")
      if (this.jstore) this.jstore.close()
      if (user) this.jstore = new V.JournumStore(this.db, new Date())
      else this.jstore = null
      this.user = user
    })
  }
}

@observer
class AppView extends React.Component<{store :AppStore}> {
  render () {
    // we have to check user to ensure an observable depend, meh
    const {user, jstore} = this.props.store
    if (user && jstore) return <V.JournumView store={jstore} />
    else return <LoginView />
  }
}

const appStore = new AppStore()
ReactDOM.render(<AppView store={appStore} />, document.getElementById("app-root"))
