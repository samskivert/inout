import * as React from "react";
import * as ReactDOM from "react-dom";

import { MuiThemeProvider, createMuiTheme } from '@material-ui/core';
import purple from '@material-ui/core/colors/purple';
import green from '@material-ui/core/colors/green';

import * as firebase from "firebase"
import * as A from "./app"

firebase.initializeApp({
  apiKey: "AIzaSyDy3Caew0ql16PM0x7laFXTcs6jih_-e8o",
  authDomain: "input-output-26476.firebaseapp.com",
  projectId: "input-output-26476",
})

const theme = createMuiTheme({
  palette: {
    primary: purple,
    secondary: green,
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

const appStore = new A.AppStore()
ReactDOM.render(
  <MuiThemeProvider theme={theme}>
    <A.AppView store={appStore} />
  </MuiThemeProvider>,
  document.getElementById("app-root"))
