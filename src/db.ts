import * as firebase from "firebase"
import * as M from "./model"

export class DB {
  db = firebase.firestore()
  uid :string = "none"

  constructor () {
    this.db.settings({timestampsInSnapshots: true})
    this.db.enablePersistence().catch(error => {
      console.warn(`Failed to enable offline mode: ${error}`)
    })
  }

  setUserId (uid :string) {
    this.uid = uid
  }

  async journal (date :Date) :Promise<M.Journum> {
    console.log(`Loading journal ${date}`)
    let dstamp = M.toStamp(date)
    let ref = this.userCollection("journal").doc(dstamp)
    try {
      let doc = await ref.get()
      let data = doc.data() || {date: dstamp, entries: {}}
      if (!doc.exists) ref.set(data).
        then(() => console.log(`Yay, created ${ref.id}`)).
        catch(err => console.warn(`Failed to set ${ref.id}: ${err}`))
      else console.log(`Loaded existing journum ${dstamp}: ${JSON.stringify(data)}`)
      return new M.Journum(ref, data)
    } catch (error) {
      console.log(`Failed to load journal [uid=${this.uid}, ref=${ref.path}, date=${dstamp}]`, error)
      throw new Error(`Database error`)
    }
  }

  private userCollection (name :string) :firebase.firestore.CollectionReference {
    return this.db.collection("users").doc(this.uid).collection(name)
  }
}
