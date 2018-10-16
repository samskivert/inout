import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as firebase from 'firebase'
import { observable } from 'mobx'
import { observer } from 'mobx-react'

let apiKey = window.location.hash
if (apiKey.startsWith('#')) apiKey = apiKey.substring(1)
console.log(`API key ${apiKey}`)

// initialize firebase and create our database
firebase.initializeApp({
  apiKey: apiKey,
  authDomain: "input-output-26476.firebaseapp.com",
  projectId: "input-output-26476",
});

let db = firebase.firestore();
db.settings({
  timestampsInSnapshots: true
});
db.enablePersistence().catch(error => {
  console.warn(`Failed to enable offline mode: ${error}`)
})

export class TestStore {
  @observable text = ""
}

const store = new TestStore()
const docRef = db.collection("test").doc("test")
docRef.onSnapshot(doc => {
  const data = doc.data()
  if (data) {
    console.log("Current data: ", data)
    store.text = data.text
  }
});

@observer
export class Test extends React.Component<{store :TestStore}> {

  render () {
    const store = this.props.store
    return (
      <div>
        <div>Text:</div>
        <input value={store.text} onChange={ev => store.text = ev.currentTarget.value} />
        <button onClick={() => this.saveText()}>Save</button>
      </div>
    )
  }

  saveText () {
    console.log(`Saving: '${this.props.store.text}'`)
    docRef.set({text: this.props.store.text})
  }
}

ReactDOM.render(<Test store={store} />, document.getElementById('root'));
