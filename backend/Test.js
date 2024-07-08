const { db, db2, messaging, dbIncrement } = require("./firebase-modules");

const Test = class {

    constructor() {

    }

    /*this method is meant to fix the transcripts on chats that are left stuck at
    "transcripting audio...", it happened because of server issues like 
    server stopped because quota was exceeded or server wasn't working for whatever reason
    and someone sent an audio and it wasn't transcripted so run this method 
    to fix this issue */
    setNoTranscript = async () => {
        const allMessages = []
        //read all documents in the rooms collection
        const rooms = await db.collection("rooms").get();
        await rooms.forEach(async room => {
            //console.log("room: ", room.id);
            //loop through each room document and read all the documents of the messages collection where transcript property is set to "$state=loading"
            const messagesData = await db.collection("rooms").doc(room.id).collection("messages").where("transcript", "==", "$state=loading").get();
            if (!messagesData.empty) {
                const messages = [];
                messagesData.forEach(message => {
                    messages.push({ ...message.data(), id: message.id });
                });
                //console.log("messages with no transcript: ", messages);
                //organize the messages then add them to allMessages array
                allMessages.push({
                    roomID: room.id,
                    messages
                });
            }
            //console.log("all messages: ", allMessages);
            allMessages.forEach(async messageData => {
                messageData.messages.forEach(messageDetails => {
                    //loop through all messages and update transcript to ""
                    db.collection("rooms").doc(messageData.roomID).collection("messages").doc(messageDetails.id).update({
                        transcript: ""
                    });
                });
            });
        });
    }

    /*this is a function to test notification, you need to put a correct userID and token, you can access this data from firestore console */
    sendNotification = () => {
        console.log("adding the notif to cloud firestore");
        db.collection("notifications2").add({
            userID: "0zs2BiVOISfMCE7mP0fT8zPiit53",
            title: "hacker bando",
            body: "wesh ya na9ch",
            photoURL: "https://lh4.googleusercontent.com/-tbJZXfy1FVg/AAAAAAAAAAI/AAAAAAAAAAA/AMZuucnmWljfyeNPES_8nI3pjSvOLx2BWw/s96-c/photo.jpg",
            href: "https://whatsappy-app.web.app/",
            token: "ewIn2h6F6WYY-vGVdTaUaI:APA91bHnYUIcHgknxazzeInzA-1ZQpn41G29QkJV8w-PDOszmpxqJdxRGLHcnXxu2jGCLWBLZjXapUY0YTIzI-NbOIwlZNzt1gh82zg4AuRGxOf1oiJeaHgTSJwEZTgHCk4UkKlVneAX",
        }).then(() => {
            console.log("notif added")
        }).catch(e => console.log(e));
    }

    //this a function that update the version field in our database, run this after you have pushed new code to your client side app
    updateAppVersion = async () => {
        await db.collection("version").doc("version").update({
            version: dbIncrement(0.01)
        });
        console.log("client app version updated")
    }

    //use this to make a user a welcome user by setting the isWelcomeChat to true or false
    updateWelcomeUser = async (userID, isWelcomeChat) => {
        try {
            await db.collection("users").doc(userID).update({
                welcomeChat: isWelcomeChat
            });
            console.log(`successfully set welcomeChat to ${isWelcomeChat} for user with ID: ${userID}`);
        } catch (error) {
            console.log(`error setting welcomeChat to ${isWelcomeChat} for user with ID: ${userID}`);
            console.log(error);
        }
    }

    //use this to make a user a n admin by setting the isAdmin to true or false
    updateAdminUser = async (userID, isAdmin) => {
        try {
            await db.collection("users").doc(userID).update({
                admin: isAdmin
            });
            console.log(`successfully set admin status to ${isWelcomeChat} for user with ID: ${userID}`);
        } catch (error) {
            console.log(`error setting admin status to ${isWelcomeChat} for user with ID: ${userID}`);
            console.log(error);
        }
    }
};

const test = new Test();
test.updateAppVersion();

module.exports = Test

/*Class Test allows us to create objects to debug test and fix our databases, it is not
meant to be used on production, it's only for development, it also allows you to manually update our database */