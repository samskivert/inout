import * as firebase from "firebase"
import * as M from "./model"

export class DB {
  db = firebase.firestore()

  constructor () {
    this.db.settings({timestampsInSnapshots: true})
    this.db.enablePersistence().catch(error => {
      console.warn(`Failed to enable offline mode: ${error}`)
    })
  }

  async journal (date :Date) :Promise<M.Journum> {
    let dstamp = M.toStamp(date)
    let ref = this.db.collection("journal").doc(dstamp)
    let doc = await ref.get()
    let data = doc.data() || {date: dstamp, entries: {}}
    if (!doc.exists) ref.set(data).
      then(() => console.log(`Yay, created ${ref.id}`)).
      catch(err => console.warn(`Failed to set ${ref.id}: ${err}`))
    else console.log(`Loaded existing journum ${dstamp}: ${JSON.stringify(data)}`)
    return new M.Journum(ref, data)
  }
}
