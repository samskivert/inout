import * as React from "react";
import * as ReactDOM from "react-dom";
import * as firebase from "firebase"
import * as V from "./views"
// import StyledFirebaseAuth from 'react-firebaseui/StyledFirebaseAuth'
import { DB } from "./db"

let apiKey = window.location.hash
if (apiKey.startsWith("#")) apiKey = apiKey.substring(1)
firebase.initializeApp({
  apiKey: apiKey,
  authDomain: "input-output-26476.firebaseapp.com",
  projectId: "input-output-26476",
})

// // Configure FirebaseUI.
// const uiConfig = {
//   // Popup signin flow rather than redirect flow.
//   signInFlow: 'popup',
//   // Redirect to /signedIn after sign in is successful. Alternatively you can provide a callbacks.signInSuccess function.
//   signInSuccessUrl: '/signedIn',
//   // We will display Google and Facebook as auth providers.
//   signInOptions: [
//     firebase.auth.GoogleAuthProvider.PROVIDER_ID,
//     firebase.auth.FacebookAuthProvider.PROVIDER_ID
//   ]
// };

// class SignInScreen extends React.Component {
//   render() {
//     return (
//       <div>
//         <h1>Input/Output</h1>
//         <p>Please sign-in:</p>
//         <StyledFirebaseAuth uiConfig={uiConfig} firebaseAuth={firebase.auth()}/>
//       </div>
//     );
//   }
// }

class AppStore {
  readonly db = new DB()
}
const appStore = new AppStore()

class AppView extends React.Component<{store :AppStore}> {
  render () {
    const store = this.props.store
    return <V.JournumView store={new V.JournumStore(store.db, new Date())} />
  }
}

ReactDOM.render(<AppView store={appStore} />, document.getElementById("app-root"))
