const express = require("express");
const algoliasearch = require('algoliasearch');
const { db, db2, messaging, storage, auth, createTimestamp, fieldIncrement } = require("./firebase-modules");
const fetch = require("cross-fetch");
const { dailyApiKey, algoliaKeys } = require("./configKeys")
const client = algoliasearch(algoliaKeys.appKey, algoliaKeys.adminKey);
const index = client.initIndex(algoliaKeys.index);
const textToAudio = require("./transcript");
const e = require("express");
//const Test = require("./Test");

const app = express();
const port = 5000;

/*const testing = new Test();
testing.updateWelcomeUser("EoC5PmATCMSS9OOIDWuhDDBw7A43", true);*/

async function wait(timeout) {
	return new Promise((resolve) => {
		setTimeout(() => {
			resolve();
		}, timeout);
	});
};

var welcomeChatUsers = [];
db.collection("users").where("welcomeChat", "in", [true]).onSnapshot(snap => {
	welcomeChatUsers = [];
	snap.forEach(welcomeUser => {
		welcomeChatUsers.push(welcomeUser.data());
	});
	console.log("welcome chat users: ", welcomeChatUsers);
});

var firstNewUserSnap = true;
db.collection("users").orderBy("name").orderBy("id").onSnapshot(snap => {
	if (!firstNewUserSnap) {
		snap.docChanges().forEach(userDocChange => {
			if (userDocChange.type === "added") {
				const newAddedUser = userDocChange.doc.data();
				console.log(`user was added `, newAddedUser);
				for (let welcomeUser of welcomeChatUsers) {
					welcomeChatMessages(welcomeUser, newAddedUser);
				};
			}
		});
	} else {
		firstNewUserSnap = false;
	};
});

db.collection("users").onSnapshot(snap => {
	handleSnap(snap, true);
	updateUserRoom(snap);
	deleteUser(snap);
});
db.collection("rooms").orderBy("timestamp").onSnapshot(snap => handleSnap(snap, false));
db2.ref('/status/').on(("child_added"), data => handleOnlineStatus(data, "child_added"));
db2.ref('/status/').on(("child_changed"), data => handleOnlineStatus(data, "child_changed"));
handleMediaUploadError();

let listening = false;
db.collection("notifications").onSnapshot(snap => {
	if (!listening) {
		console.log("listening for notifications...");
		listening = true;
	}
	const docs = snap.docChanges();
	if (docs.length > 0) {
		docs.forEach(async change => {
			if (change.type === "added") {
				const data = change.doc.data();
				if (data) {
					const message = {
						data: data,
						token: data.token
					};
					await db.collection("notifications").doc(change.doc.id).delete();
					try {
						const response = await messaging.send(message);
						console.log("notification successfully sent :", data);
					} catch (error) {
						console.log("error sending notification ", error);
					};
				};
			};
		});
	};
});

db.collection("transcripts").onSnapshot(snap => {
	const docs = snap.docChanges();
	if (docs.length > 0) {
		docs.forEach(async change => {
			if (change.type === "added") {
				const data = change.doc.data();
				if (data) {
					db.collection("transcripts").doc(change.doc.id).delete();
					try {
						const text = await textToAudio(data.audioName, data.short, data.supportWebM);
						const roomRef = db.collection("rooms").doc(data.roomID).collection("messages").doc(data.messageID);
						db.runTransaction(async transaction => {
							const roomDoc = await transaction.get(roomRef);
							if (roomDoc.exists && !roomDoc.data()?.delete) {
								transaction.update(roomRef, {
									transcript: text
								});
								console.log("transcript added with text: ", text);
								return;
							} else {
								console.log("room is deleted");
								return;
							}
						})
						db.collection("rooms").doc(data.roomID).collection("messages").doc(data.messageID).update({
							transcript: text
						});
					} catch (error) {
						console.log("error transcripting audio: ", error);
					};
				};
			};
		});
	};
});

async function sendWelcomeChat(welcomeUser, newUser, message) {
	try {
		await db.runTransaction(async transaction => {
			const newUserData = (await transaction.get(db.collection("users").doc(newUser.id))).data();
			if (newUserData?.name && !newUserData?.delete) {
				console.log(`user ${newUserData.name} is not being deleted, sending message`);
				const operations = [];
				const roomInfo = {
					lastMessage: message,
					seen: false,
				}
				const roomID = newUser.id > welcomeUser.id ? newUser.id + welcomeUser.id : welcomeUser.id + newUser.id;
				const messageToSend = {
					name: welcomeUser.name,
					message: message,
					uid: welcomeUser.id,
					timestamp: createTimestamp(),
					time: new Date().toUTCString(),
				}
				operations.push(transaction.set(db.collection("rooms").doc(roomID), roomInfo, { merge: true }));
				operations.push(transaction.set(db.collection("users").doc(newUser.id).collection("chats").doc(roomID), {
					timestamp: createTimestamp(),
					photoURL: welcomeUser.photoURL,
					name: welcomeUser.name,
					userID: welcomeUser.id,
					unreadMessages: fieldIncrement(1),
				}, { merge: true }));
				/*db.collection("users").doc(user.id).collection("chats").doc(roomID).set({
					timestamp: createTimestamp(),
					photoURL: state.photoURL ? state.photoURL
					name: state.name,
					userID: state.userID
				}, { merge: true });*/
				operations.push(transaction.set(db.collection("rooms").doc(roomID).collection("messages").doc(), messageToSend, { merge: true }));
				return Promise.all(operations);
			} else {
				throw `user ${newUserData.name} is deleting account`
			};
		});
		console.log(`Successfully sent this message "${message}" to user: ${newUser.name}`);
	} catch (error) {
		console.log(`error sending this message "${message}" to user: ${newUser.name}`);
		console.log(error);
	};
};

async function welcomeChatMessages(welcomeUser, newUser) {
	const sendMessage = async message => await sendWelcomeChat(welcomeUser, newUser, message);
	const githubRepoLink = "https://github.com/aladinyo/ChatPlus"
	await sendMessage("Hello I'm the owner of the app, it's nice to meet you and I like seeing you using my app 🎉💥");
	await wait(1000);
	await sendMessage("I would appreciate seeing you leaving a star on this app's github repository ✨⭐, let's make the whole world see this masterpiece: " + githubRepoLink);
	await wait(1000);
	await sendMessage("You can text me here, I'll receive a notification and respond to you asap, you should also accept yours, let's chat and talk a bit 🧑‍💻🚀🔮");
	await wait(1000);
	await sendMessage("Or maybe you can go for a video call, nothing is better than direct communication  🤩🎥🎦");
}

const usersDeleting = {}//state
/*This is a server function that aims at deleting the complete data of a user */
function deleteUser(snapshot) {
	//check all users
	snapshot.docs.forEach(async (user) => {
		//get the user data
		const userData = user.data();
		//if the user requested to delete his accounts
		if (userData.delete && !usersDeleting[userData.id]) {
			usersDeleting[userData.id] = true;
			console.log("deleting user: ", userData);
			//we delete the user from Auth service in order to prevent him from siging in to his account while it's
			//being deleted, if the user manages to sign out and sigin in while deleting his account, he will sign in
			//to his account with another user id, which prevents him from accessing old account
			try {
				await auth.deleteUser(userData.id);
				console.log("delete from auth user: ", userData.id);
			} catch (e) {
				console.log("error deleting auth user: " + userData.id + " with context: ", e);
			}
			//we get all his chats
			const chatsSnap = await db.collection("users").doc(userData.id).collection("chats").get();
			var operations = [];
			async function deleteRoom(chat) {
				const chatData = chat.data();
				//we select the chats he had privately with other users, we don't pick public chats
				if (chatData.userID) {
					try {
						// we get the roomID of the chat then proceed to delete it
						const roomID = userData.id > chatData.userID ? userData.id + chatData.userID : chatData.userID + userData.id;
						const room = db.collection("rooms").doc(roomID);
						//update the room data delete to true to prevent the other user from sending messages or modifying the room
						await room.set({
							delete: true
						}, { merge: true });
						//get all the messages in the chat
						const fetchedMessages = await room.collection("messages").get();
						const fetchedAudios = [];
						const fecthedImages = [];
						//get all the audio files names and image files names
						fetchedMessages.docs.forEach(doc => {
							if (doc.data().audioName) {
								fetchedAudios.push(doc.data().audioName);
							} else if (doc.data().imageName) {
								fecthedImages.push(doc.data().imageName);
							}
						});
						//this is an array that contains chats doc id of both users
						const usersChats = [userData.id, chatData.userID];
						//all these processes are gonna run asynchronously, they do not wait for each other to save time,
						//and the promise will reolve when they all have resolved.
						await Promise.all([
							//delete the call doc
							db.collection("users").doc(userData.id).collection("call").doc("call").delete(),
							//delete all messages docs
							...fetchedMessages.docs.map(doc => doc.ref.delete()),
							//delete all image files from storage
							...fecthedImages.map(img => storage.file("images/" + img).delete()),
							//delete all audio files from storage
							...fetchedAudios.map(aud => storage.file("audios/" + aud).delete()),
							//delete the room from the chats of both users
							...usersChats.map(userChat => db.collection("users").doc(userChat).collection("chats").doc(roomID).delete()),
							//finally delete the room
							room.delete()
						]);
						console.log("deleted room of user: " + userData.id + " that he talked in with user: ", chatData.userID);
					} catch (e) {
						console.log("error deleting room of user: " + userData.id + " that he talked in with user: ", chatData.userID);
						console.log(e.message);
					};
				}
			};
			chatsSnap.forEach(chat => {
				operations.push(deleteRoom(chat));
			})
			//wait for all the chats and rooms to be deleted
			await Promise.all(operations);
			operations = [];
			//delete from firestore
			operations.push((async () => {
				try {
					await db.collection("users").doc(userData.id).delete();
					console.log("deleted user from firestore: ", userData.id);
				} catch (e) {
					console.log("firestore user delete error: ", e);
				}
			})());
			await Promise.all(operations);
			console.log("completely deleted user: ", userData.name);
			usersDeleting[userData.id] = null;
		}
	});
}

/*this a server function that aims at updating media upload status to error when users lose connection
while uploading media on a chat it works for images and audios on chats*/
function handleMediaUploadError() {
	var userMessageListeners = {}
	var messagesListeners = {}
	//listen to all the rooms
	db.collection("rooms").onSnapshot(roomsSnap => {
		roomsSnap.docChanges().forEach(roomChange => {
			/*attach the messages listener only once, and that's why we need to check that change type is "added",
			when rooms update, it's basically updates about the last message and we don't need that and 
			when this listener executes for the first time it whill run with change type of added*/
			if (roomChange.type === "added") {
				/*listen to the messages of each room and store the unsuscribe function to our messagesListeners object */
				const messagesReference = db.collection("rooms").doc(roomChange.doc.id).collection("messages");
				messagesListeners[roomChange.doc.id] = messagesReference.onSnapshot(messagesSnap => {
					messagesSnap.docChanges().forEach(messageChange => {
						/*When a message is added we check whether it had a media being uploaded 
						if you get any server error and your media was stuck on uploading then we can also
						check whether the media is being uploaded because we also listen on "modified" change*/
						if (messageChange.type === "added" || messageChange.type === "modified") {
							const messageData = messageChange.doc.data();
							const mediaType = messageData.imageUrl ? "image" : messageData.audioUrl ? "audio" : false;
							if (mediaType) {
								if ((messageData[mediaType + "Url"] === "uploading") && !userMessageListeners[messageChange.doc.id]) {
									/*if we have a media loading we start listening to the online state of the user who sent the message and store
									the unsubscribe function to userMessageListeners Object*/
									userMessageListeners[messageChange.doc.id] = db.collection("users").doc(messageData.uid).onSnapshot(userSnap => {
										const userStatus = userSnap.data();
										/*if the user become offline we update uploading status to error this will trigger the messages listener
										to give us another snapshot with type "modified" */
										if (userStatus.state === "offline") {
											console.log(`user ${userStatus.name} went offline so we're setting the ${mediaType}Url to error`);
											messagesReference.doc(messageChange.doc.id).set({
												[mediaType + "Url"]: "error"
											}, { merge: true });
										}
									});
								} else {
									/*after our message was modified, we unsubscribe from the user listener whether we had an error
									or media was successfully uploaded, if imageUrl isn't "uploading" than it's either a URL or "error"*/
									if (userMessageListeners[messageChange.doc.id]) {
										userMessageListeners[messageChange.doc.id]();
									}
								}
							}
						}
					})
				});
			} else if (roomChange.type === "removed") {
				/*when a room is deleted we stop listening to its messages changes */
				if (messagesListeners[roomChange.doc.id]) {
					messagesListeners[roomChange.doc.id]();
				}
			}
		});
	});
}

var previousUsersData = {};

function updateUserRoom(snap) {
	const users = snap.docChanges();
	var newUsersData = {};
	users.forEach(userData => {
		const data = userData.doc.data();
		newUsersData[data.id] = {
			state: data.state,
			id: data.id,
			onRoom: data.onRoom,
			name: data.name,
			changeType: userData.type
		}
		if (previousUsersData[data.id]) {
			if (previousUsersData[data.id].state !== newUsersData[data.id].state && newUsersData[data.id].state === "offline" && newUsersData[data.id].onRoom) {
				console.log("setting the false typing for user with data: ", data.name);
				db.collection("users").doc(data.id).set({
					onRoom: false
				}, { merge: true });
				db.collection("rooms").doc(newUsersData[data.id].onRoom).set({
					[data.id]: false
				}, { merge: true });
			};
		}
		previousUsersData[data.id] = newUsersData[data.id];
	});
}

function handleSnap(snap, update) {
	const docs = snap.docChanges();
	if (docs.length > 0) {
		docs.forEach(async change => {
			if (change.type === "added" || (change.type === "modified") && update) {
				const data = change.doc.data();
				data.objectID = change.doc.id;
				if (!update) {
					data.lastMessage = "";
				};
				await index.saveObject(data).catch(e => "handleSnap saveObject failed", e);
				console.log("object succesfully saved with id: " + data.objectID);
			} else if (change.type === "removed") {
				await index.deleteObject(change.doc.id).catch(e => "handleSnap deleteObject failed", e);
				console.log("object succesfully deleted with id: " + change.doc.id);
			}
		});
	};
};

const deleteCallFromUser = userID => db.collection("users").doc(userID).collection("call").doc("call").delete();

async function handleCallDelete(userStatus) {
	if (userStatus.state === "offline") {
		const callDoc = await db.collection("users").doc(userStatus.id).collection("call").doc("call").get();
		const call = callDoc.data();
		if (call) {
			if (call.otherUserJoined === false && call.isCaller) {
				console.log("deleting call from firebase services for user: " + userStatus.id);
				deleteCallFromUser(call.callerID);
				deleteCallFromUser(call.otherID);
				try {
					fetch("https://api.daily.co/v1/rooms/" + call.room.name, {
						headers: {
							Authorization: `Bearer ${dailyApiKey}`,
							"Content-Type": "application/json"
						},
						method: "DELETE"
					});
				} catch (e) {
					console.log("error deleting room for call delete!!");
					console.log(e);
				};
			};
		}
	};
};

async function handleOnlineStatus(data, event) {
	try {
		console.log("setting online status with event: ", event);
		// Get the data written to Realtime Database
		const eventStatus = data.val();
		// Then use other event data to create a reference to the
		// corresponding Firestore document.
		const userStatusFirestoreRef = db.doc(`users/${eventStatus.id}`);

		// It is likely that the Realtime Database change that triggered
		// this event has already been overwritten by a fast change in
		// online / offline status, so we'll re-read the current data
		// and compare the timestamps.
		const statusSnapshot = await data.ref.once('value');
		const status = statusSnapshot.val();
		// If the current timestamp for this data is newer than
		// the data that triggered this event, we exit this function.
		if (eventStatus.state === "online") {
			console.log("event status: ", eventStatus)
			console.log("status: ", status)
		}
		if (status.last_changed <= eventStatus.last_changed) {
			// Otherwise, we convert the last_changed field to a Date
			eventStatus.last_changed = new Date(eventStatus.last_changed);
			//handle the call delete
			handleCallDelete(eventStatus);
			// ... and write it to Firestore.
			await userStatusFirestoreRef.set(eventStatus, { merge: true });
			console.log("user: " + eventStatus.id + " online status was succesfully updated with data: " + eventStatus.state);
		} else {
			console.log("next status timestamp is newer for user: ", eventStatus.id);
		}
	} catch (error) {
		console.log("handle online status crashed with error :", error)
	}
}

app.listen(port, () => console.log("server running on port " + port));