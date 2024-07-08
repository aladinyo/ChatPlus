import db, { createTimestamp, createTimestamp2, db2 } from "./firebase";

var disconnectRef;

function setOnlineStatus(uid) {
	try {
		console.log("setting up online status");
		const isOfflineForDatabase = {
			state: 'offline',
			last_changed: createTimestamp2,
			id: uid,
		};

		const isOnlineForDatabase = {
			state: 'online',
			last_changed: createTimestamp2,
			id: uid
		};
		const userStatusFirestoreRef = db.collection("users").doc(uid);
		const userStatusDatabaseRef = db2.ref('/status/' + uid);

		// Firestore uses a different server timestamp value, so we'll 
		// create two more constants for Firestore state.
		const isOfflineForFirestore = {
			state: 'offline',
			last_changed: createTimestamp(),
		};

		const isOnlineForFirestore = {
			state: 'online',
			last_changed: createTimestamp(),
		};

		disconnectRef = db2.ref('.info/connected').on('value', function (snapshot) {
			console.log("listening to database connected info")
			if (snapshot.val() === false) {
				// Instead of simply returning, we'll also set Firestore's state
				// to 'offline'. This ensures that our Firestore cache is aware
				// of the switch to 'offline.'
				userStatusFirestoreRef.set(isOfflineForFirestore, { merge: true });
				return;
			};

			userStatusDatabaseRef.onDisconnect().set(isOfflineForDatabase).then(function () {
				userStatusDatabaseRef.set(isOnlineForDatabase);

				// We'll also add Firestore set here for when we come online.
				userStatusFirestoreRef.set(isOnlineForFirestore, { merge: true });
			});
		});
	} catch (error) {
		console.log("error setting onlins status: ", error);
	}
};

export { disconnectRef }

export default setOnlineStatus;