importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-messaging.js');

firebase.initializeApp({
    apiKey: "XXXXXXXXXXXXXXXXXXXXX",
    authDomain: "XXXXXXXX.firebaseapp.com",
    projectId: "XXXXXXXXXXX",
    storageBucket: "XXXXXXXXX.appspot.com",
    messagingSenderId: "XXXXXXXXXXXX",
    appId: "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    measurementId: "X-XXXXXXXXXXXXXXXXXXXXX",
    databaseURL: "https://XXXXXXXXXXXXXXXXXXXXXXXXXXXXX.firebasedatabase.app"
})

const messaging = firebase.messaging();

var href = self.location.origin;

messaging.onBackgroundMessage(payload => {
    const title = payload.data.title;
    console.log("payload: ", payload);
    const options = payload.data.image ? {
        badge: "app_icon.png",
        body: payload.data.body,
        icon: payload.data.photoURL,
        renotify: true,
        tag: payload.data.userID,
        image: payload.data.image,
    } : {
        badge: "app_icon.png",
        body: payload.data.body,
        icon: payload.data.photoURL,
        renotify: true,
        tag: payload.data.userID
    }
    self.registration.showNotification(title, options);
});

console.log("firebase sw is working");
console.log("sw location: ", self.location);

self.addEventListener('notificationclick', event => {
    event.notification.close();
    self.clients.openWindow(href);
})