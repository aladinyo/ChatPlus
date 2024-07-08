const admin = require("firebase-admin");
const { getStorage } = require('firebase-admin/storage');
const serviceAccount = require("./serviceAccountKey.json");
const { firebaseDatabaseURL, firebaseStorageBucket } = require("./configKeys")

admin.initializeApp({
	credential: admin.credential.cert(serviceAccount),
	databaseURL: firebaseDatabaseURL
});

const db = admin.firestore();
const dbIncrement = admin.firestore.FieldValue.increment
const db2 = admin.database();
const messaging = admin.messaging();
const storage = getStorage().bucket(firebaseStorageBucket);
const auth = admin.auth();
const createTimestamp = admin.firestore.FieldValue.serverTimestamp;
const fieldIncrement = admin.firestore.FieldValue.increment;

module.exports = {
    db,
    db2,
    messaging,
    dbIncrement,
    storage,
    auth,
    createTimestamp,
    fieldIncrement
}