import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import "firebase/compat/firestore";
import "firebase/compat/database"
import "firebase/compat/messaging";
import "firebase/compat/storage"
import { firebaseConfig } from "./configKeys";

const firebaseApp = firebase.initializeApp(firebaseConfig);

const db = firebaseApp.firestore();
const runTransaction = db.runTransaction;
const db2 = firebaseApp.database();
const auth = firebaseApp.auth();
const provider = new firebase.auth.GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });
const createTimestamp = firebase.firestore.FieldValue.serverTimestamp;
const createTimestamp2 = firebase.database.ServerValue.TIMESTAMP;
const messaging = "serviceWorker" in navigator && "PushManager" in window ? firebase.messaging() : null;
const fieldIncrement = firebase.firestore.FieldValue.increment;
const arrayUnion = firebase.firestore.FieldValue.arrayUnion;
const storage = firebase.storage().ref("images");
const audioStorage = firebase.storage().ref("audios");

export { auth, provider, createTimestamp, messaging, fieldIncrement, arrayUnion, storage, audioStorage, db2, createTimestamp2, runTransaction };
export default db;