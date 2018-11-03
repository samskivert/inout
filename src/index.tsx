import * as React from "react";
import * as ReactDOM from "react-dom";
import * as firebase from "firebase"

// import blue from '@material-ui/core/colors/blue';
import blueGrey from '@material-ui/core/colors/blueGrey';

import * as S from "./stores"
import * as A from "./app"
import * as UI from "./ui"

firebase.initializeApp({
  apiKey: "AIzaSyDy3Caew0ql16PM0x7laFXTcs6jih_-e8o",
  authDomain: "input-output-26476.firebaseapp.com",
  projectId: "input-output-26476",
})

const theme = UI.createMuiTheme({
  palette: {
    // primary: blue,
    secondary: blueGrey,
  },
  spacing: {
    unit: 6,
  },
  overrides: {
    MuiButton: {
      sizeSmall: {
        fontSize: 11,
      }
    },
    MuiIconButton: {
      root: {
        padding: 6,
      }
    },
    MuiListItem: {
      root: {
        paddingTop: 0,
        paddingBottom: 0,
      },
    },
    MuiListItemText: {
      root: {
        padding: 0,
        margin: "6px 6px 6px 0px",
      }
    },
  },
});

const appStore = new S.AppStore()
ReactDOM.render(
  <UI.MuiThemeProvider theme={theme}>
    <A.AppView store={appStore} />
  </UI.MuiThemeProvider>,
  document.getElementById("app-root"))
