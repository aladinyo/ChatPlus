import { useState, useEffect, memo, useRef } from 'react';
import Sidebar from './Sidebar';
import Chat from './Chat';
import Login from './Login';
import Call from "./Call/Call";
import setOnlineStatus from "./setOnlineStatus";
import { Route, useLocation, Redirect } from 'react-router-dom';
import { useStateValue } from './StateProvider';
import CircularProgress from '@mui/material/CircularProgress';
import db, { auth, provider, createTimestamp, messaging, db2 } from './firebase';
import { TransitionGroup, Transition, CSSTransition } from "react-transition-group";
import './App.css';
import useRoomsData from './useRoomsData';
import scalePage from "./scalePage";
import useFetchData from "./useFetchData.js";
import { deleteCall } from './Call/Model/api';
import MultipleAccessError from './MultipleAccessError.js';
import DeleteUser from './DeleteUser.js';
import audio2 from "./message_sent.mp3";
import audio1 from "./message_received.mp3";
import audio from './notification.mp3'

/*function detectBrowser() {
	if ((navigator.userAgent.indexOf("Opera") || navigator.userAgent.indexOf('OPR')) != -1) {
		return 'Opera';
	} else if (navigator.userAgent.indexOf("Chrome") != -1) {
		return 'Chrome';
	} else if (navigator.userAgent.indexOf("Safari") != -1 || navigator.userAgent.indexOf("AppleWebKit") != -1) {
		return 'Safari';
	} else if (navigator.userAgent.indexOf("Firefox") != -1) {
		return 'Firefox';
	} else if ((navigator.userAgent.indexOf("MSIE") != -1) || (!!document.documentMode == true)) {
		return 'IE';//crap
	} else {
		return 'Unknown';
	}
}

const isSafari = detectBrowser() === "Safari";
console.log({ isSafari })*/

const configureNotif = (docID) => {
  messaging.getToken().then((token) => {
    console.log(token);
    db.collection("users").doc(docID).set({
      token: token
    }, { merge: true })
  }).catch(e => {
    console.log(e.message);
    db.collection("users").doc(docID).set({
      token: ""
    }, { merge: true });
  });
}

const now = performance.now();

function App() {
  const [{ user, path, pathID, roomsData, page }, dispatch, actionTypes] = useStateValue();
  const [loader, setLoader] = useState(true);
  const [pwaEvent, setPwaEvent] = useState(undefined);
  const [updating, setUpdating] = useState(false);
  const [checkingVersion, setCheckingVerison] = useState(true);
  const [chats, setChats] = useState(null);
  const [mounted, setMounted] = useState(false);
  const [chatsFetched, setChatsFetched] = useState();
  const [MultipleAccess, setMultipleAccess] = useState("checking");
  const [deletePath, setDeletePath] = useState("");
  const [openDelete, setOpenDelete] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const location = useLocation();
  const [setRoomsData] = useRoomsData();
  const messageSentAudio = useRef(new Audio());
  const messageReceivedAudio = useRef(new Audio());
  const notification = useRef(new Audio());
  const b = useRef([]);
  const audioList = useRef({});
  const menus = ["/rooms", "/search", "/users", "/chats"];
  const onRoomUpdate = useRef(false);
  const roomOnline = useRef({});
  //const updatedChats = useRef(false);

  const [rooms, fetchRooms] = useFetchData(30, db.collection("rooms").orderBy("timestamp", "desc"), true, snap => {
    return snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
  }, "rooms");

  const [users, fetchUsers] = useFetchData(30, db.collection("users").orderBy("timestamp", "desc"), true, snap => {
    const data = [];
    if (snap.docs.length > 0) {
      snap.docs.forEach((doc) => {
        const id = doc.id > user.uid ? doc.id + user.uid : user.uid + doc.id;
        if (doc.id !== user.uid) {
          data.push({
            ...doc.data(),
            id,
            userID: doc.id,
          });
          setRoomsData(doc.id, id);
        };
      });
    };
    return data;
  }, "users");

  useEffect(() => {
    messageReceivedAudio.current.src = audio1;
    messageSentAudio.current.src = audio2;
    notification.current.src = audio;
  }, []);

  useEffect(() => {
    //isSafari && auth.signInAnonymously().then(credential => console.log("fake user: ", credential));
    auth.onAuthStateChanged(authUser => {
      if (authUser) {
        dispatch({ type: actionTypes.SET_USER, user: authUser });
        //console.log(authUser);
        db.collection("version").doc("version").get().then(doc => {
          const version = doc.data().version;
          const previousVersion = localStorage.getItem("version");
          if (previousVersion) {
            //console.log("previous version exists in local storage")
            if (version !== +previousVersion) {
              //console.log("new version is not equal to previous version")
              localStorage.setItem("version", version);
              setUpdating(true);
              auth.signOut();
              auth.signInWithRedirect(provider).catch(e => alert(e.message))
            } else {
              setCheckingVerison(false)
            }
          } else {
            //console.log("previous version doesn't exists in local storage")
            localStorage.setItem("version", version);
            setCheckingVerison(false)
          }
        });
        const ref = db.collection("users").doc(authUser.uid);
        ref.get().then(doc => {
          const data = doc.data();
          if (data) {
            /*console.log("user data: ", doc.data());
            if (data.state === "online") {
              setMultipleAccess(true);
            } else {
              setMultipleAccess(false);
            }*/
            if (data.timestamp) {
              //console.log("updating user")
              return ref.set({
                name: authUser.displayName,
                photoURL: authUser.photoURL + "?" + now,
              }, { merge: true })
            }
          } else {
            setMultipleAccess(false);
          }
          console.log("setting user")
          return ref.set({
            name: authUser.displayName,
            photoURL: authUser.photoURL + "?" + now,
            timestamp: createTimestamp(),
          }, { merge: true })
        });
      } else {
        dispatch({ type: actionTypes.SET_USER, user: null });
        //console.log(user);
        setLoader(false);
        db.collection("version").doc("version").get().then(doc => {
          const version = doc.data().version;
          const previousVersion = localStorage.getItem("version");
          if (previousVersion) {
            //console.log("previous version exists in local storage")
            if (version !== +previousVersion) {
              //console.log("new version is not equal to previous version")
              localStorage.setItem("version", version);
              setCheckingVerison(false)
            } else {
              setCheckingVerison(false)
            }
          } else {
            //console.log("previous version doesn't exists in local storage")
            localStorage.setItem("version", version);
            setCheckingVerison(false)
          }
        })
      }
    })
  }, []);

  useEffect(() => {
    window.addEventListener("unload", deleteCall);
    window.addEventListener('beforeinstallprompt', (e) => {
      // Prevent the mini-infobar from appearing on mobile
      //console.log("pwa event executed");
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setPwaEvent(e);
      // Update UI notify the user they can install the PWA
    });
    window.addEventListener("resize", () => {
      setMounted(false);
      dispatch({ type: "set_scale_page", page: scalePage() });
    })
  }, []);

  useEffect(() => {
    if (user) {
      db.collection("users").doc(user.uid).collection("chats").orderBy("timestamp", "desc").onSnapshot(/*{ includeMetadataChanges: true },*/ snap => {
        if (snap.docs?.length > 0) {
          snap.docChanges().forEach(change => {
            if (change.type === "added") {
              setRoomsData(change.doc.data().userID, change.doc.id);
            };
          });
          if (/*!snap.metadata.fromCache || (!window.navigator.onLine && snap.metadata.fromCache)*/true) {
            setChats(snap.docs.map(cur => {
              return {
                ...cur.data(),
                photoURL: cur.data().photoURL,
                id: cur.id
              }
            }));
          };
        } else {
          setChats([]);
        };
      });
      fetchRooms(() => null);
      fetchUsers(() => null);
      db.collection("users").doc(user.uid).onSnapshot(snap => {
        setIsAdmin(snap.data()?.admin);
      });
    };
  }, [user]);

  /*useEffect(() => {
    console.log("chats: ", chats);
    async function chatsUpdate() {
      if (chats?.length > 0 && !updatedChats.current) {
        var newChats = [...chats];
        console.log("updating chats");
        for (let i = 0; i < chats.length; i++) {
          if (chats[i].userID) {
            const userData = (await db.collection("users").doc(chats[i].userID).get()).data();
            console.log("new user data: ", userData)
            newChats[i].name = userData.name;
            newChats[i].photoURL = userData.photoURL;
          }
        }
        setChats(newChats);
        updatedChats.current = true;
      }
    }
    chatsUpdate();
  }, [chats]);*/

  useEffect(() => {
  
    if (chats?.length > 0) {
      /*console.log("all the chats: ", chats);
      console.log("rooms data: ", roomsData);
      console.log("room chat condition: ", chats.every(cur => roomsData[cur.id]?.lastMessage || roomsData[cur.id]?.lastMessage === ""))*/
      if (chats.every(cur => roomsData[cur.id]?.lastMessage || roomsData[cur.id]?.lastMessage === "")) {
        setChatsFetched(true);
      };
    } else if (chats?.length === 0) {
      setChatsFetched(true);
    }
  }, [chats, roomsData]);

  useEffect(() => {
    if (user) {
      db2.ref().child("status").child(user.uid).get().then(doc => {
        //console.log("user data: ", doc.val());
        if (doc.val()?.state === "online") {
          setMultipleAccess(true);
        } else {
          setMultipleAccess(false);
        }
      })
    }
  }, [user])

  useEffect(() => {
    var s;
    console.log("multiple access:", MultipleAccess)
    if (user && !MultipleAccess && !checkingVersion) {
      setLoader(false)
      if ("serviceWorker" in navigator && "PushManager" in window) {
        console.log("This browser supports notifications and service workers")
        configureNotif(user.uid);
      }
      setOnlineStatus(user.uid);
    }
    return () => {
      if (s) {
        s();
      };
    };
  }, [user, MultipleAccess, checkingVersion]);

  useEffect(() => {
    var id = location.pathname.replace("/room/", "");
    menus.forEach(cur => id = id.replace(cur, ""))
    dispatch({ type: "set_path_id", id });
  }, [location.pathname]);

  useEffect(() => {
    if (location.pathname.includes("/room/") && user) {
      db.collection("users").doc(user.uid).set({
        onRoom: location.pathname.split("/room/")[1]
      }, { merge: true });
      onRoomUpdate.current = true;
    } else if (!location.pathname.includes("/room/") && onRoomUpdate.current) {
      db.collection("users").doc(user.uid).set({
        onRoom: false
      }, { merge: true });
      onRoomUpdate.current = false;
    }
  }, [location, user]);

  return (
    <div className="app" style={!page.initial ? { ...page } : {}} >
      {page.width <= 760 ?
        <Redirect to="/chats" />
        : <Redirect to="/" />}
      {!user && !loader && !checkingVersion && !updating ?
        <Login />
        : user && !updating && (MultipleAccess && MultipleAccess !== "checking") ?
          <MultipleAccessError />
          : user && !updating && chatsFetched && !MultipleAccess &&!loader ?
            <div className="app__body">
              <Call />
              <Sidebar notification={notification} setOpenDelete={setOpenDelete} deletePath={deletePath} mounted={mounted} setMounted={setMounted} chats={chats} pwa={pwaEvent} rooms={rooms} fetchRooms={fetchRooms} users={users} fetchUsers={fetchUsers} />
              <DeleteUser setLoader={setLoader} openDelete={openDelete} setOpenDelete={setOpenDelete} />
              <TransitionGroup component={null} >
                {page.width <= 760 ?
                  <Transition
                    key={location.pathname.replace("/image", "").replace("/call", "")}
                    timeout={300}
                  >
                    {state => (
                      <Route location={location} path={`${path}/room/:roomID`}>
                        <Chat
                          b={b}
                          unreadMessages={chats?.length > 0 ? chats.find(cur => cur.id === pathID)?.unreadMessages : 0}
                          animState={state}
                          audioList={audioList}
                          setDeletePath={setDeletePath}
                          messageReceivedAudio={messageReceivedAudio}
                          messageSentAudio={messageSentAudio}
                          roomOnline={roomOnline}
                          isAdmin={isAdmin}
                        />
                      </Route>
                    )}
                  </Transition>
                  :
                  <CSSTransition
                    key={location.pathname.replace("/image", "").replace("/call", "")}
                    timeout={310}
                    classNames="page"
                  >
                    {state => (
                      <Route location={location} path={`${path}/room/:roomID`}>
                        <Chat
                          b={b}
                          unreadMessages={chats?.length > 0 ? chats.find(cur => cur.id === pathID)?.unreadMessages : 0}
                          animState={state}
                          audioList={audioList}
                          setDeletePath={setDeletePath}
                          messageReceivedAudio={messageReceivedAudio}
                          messageSentAudio={messageSentAudio}
                          roomOnline={roomOnline}
                          isAdmin={isAdmin}
                        />
                      </Route>
                    )}
                  </CSSTransition>
                }
              </TransitionGroup>
            </div> :
            <div className="loader__container">
              <CircularProgress size={100} />
            </div>
      }
    </div>
  );
}

export default memo(App);