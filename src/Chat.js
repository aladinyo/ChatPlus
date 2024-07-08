import { useState, useEffect, useLayoutEffect, useRef, useMemo, memo, useCallback } from 'react';
import { Avatar, IconButton } from '@mui/material';
import { TransitionGroup, Transition, CSSTransition } from "react-transition-group";
import { CallRounded, VideocamRounded, MoreVert, DoneAllRounded, ArrowDownward, ArrowBack } from '@mui/icons-material';
import Backdrop from '@mui/material/Backdrop';
import { useParams, useRouteMatch, useLocation, Route, useHistory } from 'react-router-dom';
import db, { createTimestamp, fieldIncrement, storage, audioStorage } from "./firebase";
import { useStateValue } from './StateProvider';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import CircularProgress from '@mui/material/CircularProgress';
import Messages from './Messages.js';
import MediaPreview from "./MediaPreview";
import ImagePreview from "./ImagePreview";
import ChatFooter from "./ChatFooter";
import Compressor from 'compressorjs';
import { v4 as uuidv4 } from 'uuid';
import './Chat.css';
import bg from "./bg.png";
import startVideoCall from './Call/Model/StartVideoCall';
import * as pdfjsLib from 'pdfjs-dist/webpack';
import { nanoid } from 'nanoid';
/*import { createPortal } from 'react-dom';
import DeleteUser from './DeleteUser.js';
import { Switch } from 'react-router-dom/cjs/react-router-dom.min.js';*/

function smoothScroll({ element, duration, fullScroll, exitFunction, halfScroll }) {
    requestAnimationFrame(start => {
        //const scrollAmount = element.scrollHeight - element.offsetHeight - element.scrollTop;
        const isElementScrolledScreen = element.scrollHeight - element.scrollTop >= element.offsetHeight * 2;
        /*console.log("scrollTop: ", element.scrollTop)
        console.log("scrollTHeight: ", element.scrollHeight)
        console.log("offsetHeight: ", element.offsetHeight)
        console.log("isElementScrolledScreen: ", isElementScrolledScreen);*/
        const scrollAmount = fullScroll ? element.offsetHeight : element.scrollHeight - element.offsetHeight - element.scrollTop;
        /*console.log("scroll ammount: ", scrollAmount);
        console.log("scroll height calculated: ", element.scrollHeight - element.offsetHeight)
        console.log("initial scroll top: ", element.scrollTop)*/
        //element.scrolltop = element.scrollHeight - element.offsetHeight * 2;
        const initialScrollTop = fullScroll && isElementScrolledScreen && !halfScroll ? element.scrollHeight - element.offsetHeight * 2 : element.scrollTop;
        requestAnimationFrame(function animate(time) {
            let timeFraction = (time - start) / duration;
            if (timeFraction > 1) timeFraction = 1;
            element.scrollTop = initialScrollTop + timeFraction * scrollAmount;
            /*console.log("scroll top: ", element.scrollTop)
            console.log("tile fraction: ", timeFraction);*/
            if (timeFraction < 1) {
                requestAnimationFrame(animate);
            } else {
                exitFunction && exitFunction();
            }
        });
    });
};

const wait = time => new Promise(resolve => setTimeout(resolve, time));

async function fileIndexer(files) {
    const imagesSrc = [];
    const imageFiles = [];
    const filesArray = Array.from(files);
    for (let index = 0; index < filesArray.length; index++) {
        const fileLink = URL.createObjectURL(filesArray[index]);
        const pdf = await pdfjsLib.getDocument(fileLink).promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        canvas.width = viewport.width
        canvas.height = viewport.height
        await page.render({
            canvasContext: context,
            viewport,
        }).promise;
        imagesSrc[index] = canvas.toDataURL("image/png");
        const blob = await (await fetch(imagesSrc[index])).blob();
        const file = new File([blob], nanoid() + ".png", blob);
        imageFiles[index] = file;
    };
    return { imagesSrc, imageFiles, files: filesArray };
};

function mediaIndexer(files) {
    const imagesSrc = [];
    const filesArray = Array.from(files);
    filesArray.forEach((file, index) => {
        imagesSrc[index] = URL.createObjectURL(file);
    });
    return { imagesSrc, imageFiles: filesArray };
}

function Chat({ animState, unreadMessages, b, audioList, messageSentAudio, messageReceivedAudio, roomOnline, isAdmin }) {
    const [input, setInput] = useState("");
    const { roomID } = useParams();
    const location = useLocation()
    const match = useRouteMatch();
    const [{ dispatchMessages, user, roomsData, page, call }, dispatch, actionTypes] = useStateValue();
    const [imagePreview, setImagePreview] = useState({})
    const [messages, setMessages] = useState([]);
    const [openMenu, setOpenMenu] = useState(null);
    const [deleting, setDeleting] = useState(false);
    const [focus, setFocus] = useState(false);
    const [token, setToken] = useState('');
    const [state, setState] = useState(location.state ? location.state : {});
    const [seen, setSeen] = useState(false);
    const [typing, setTyping] = useState(false);
    const [src, setSRC] = useState([]);
    const [image, setImage] = useState([]);
    const [files, setFiles] = useState([]);
    const writeState = useRef("firstMount");
    const [ratio, setRatio] = useState([]);
    const [scrollArrow, setScrollArrow] = useState(false);
    const [clientWidth, setClientWidth] = useState(null);
    const [firstRender, setFirstRender] = useState(false);
    const [sendAnim, setSendAnim] = useState(false);
    const [limitReached, setLimitReached] = useState(Boolean(dispatchMessages[roomID]?.limitReached));
    const [otherUserInCall, setOtherUserInCall] = useState(false);
    const [lastMHeight, setLastMHeight] = useState(0);
    const [collapse, setCollapse] = useState({});
    const [activeElement, setActiveElement] = useState(0);
    const [isMedia, setIsMedia] = useState(false);
    const [showDrag, setShowDrag] = useState(false);
    const [otherUserDelete, setOtherUserDelete] = useState("checking");
    const history = useHistory();
    const chatBodyRef = useRef();
    const lastMessageRef = useRef(null);
    const chatBodyContainer = useRef();
    const chatAnim = useRef();
    const mediaPreview = useRef();
    const prevMessages = useRef([])
    const limit = useRef(30);
    const prevScrollHeight = useRef(null);
    const [audioID, setAudioID] = useState(null);
    const paginating = useRef(null);
    const paginating2 = useRef(null);
    const [paginateLoader, setPaginateLoader] = useState(false);
    const mediaSnap = useRef([]);
    const mediaChecked = useRef(false);
    const fileTexts = useRef([]);
    const sendingMessage = useRef(false);
    const prevScrollTop = useRef(false);
    const disconnected = useRef(false);

    const change = useCallback(function (e) {
        setInput(e.target.value);
        fileTexts.current[activeElement] = e.target.value;
    }, [activeElement]);

    useEffect(() => {
        const listeners = [];
        var userDelete = false;
        var roomDelete = false;
        if (state.userID && roomID && listeners.length === 0 && (!otherUserDelete || otherUserDelete === "checking")) {
            /*console.log("other user exists with state: ", state);
            console.log("other user exists with roomID: ", roomID);*/
            listeners.push(db.collection("users").doc(state.userID).onSnapshot(user => {
                //console.log("other user delete: ", user.data()?.delete);
                //console.log("other user delete data: ", user.data());
                userDelete = user.data()?.delete && user.data()?.name;
                setOtherUserDelete(userDelete || roomDelete);
                if (userDelete || roomDelete) {
                    listeners.forEach(cur => cur());
                }
            }));
            listeners.push(db.collection("rooms").doc(roomID).onSnapshot(room => {
                //console.log("room delete: ", room.data()?.delete);
                roomDelete = room.data()?.delete;
                setOtherUserDelete(userDelete || roomDelete);
                if (userDelete || roomDelete) {
                    listeners.forEach(cur => cur());
                }
            }));
        } else if (!otherUserDelete || otherUserDelete === "checking") {
            //console.log("other user doesn't exist: ", user, roomID);
            setOtherUserDelete(false);
        }

        return () => {
            listeners.forEach(cur => cur());
        }
    }, [state, roomID, otherUserDelete]);

    useEffect(() => {
        if (writeState.current !== "firstMount") {
            if (state?.userID) {
                db.collection("rooms").doc(roomID).set({
                    [user.uid]: true,
                }, { merge: true }).then(() => {
                    writeState.current = setTimeout(() => {
                        db.collection("rooms").doc(roomID).set({
                            [user.uid]: false,
                        }, { merge: true });
                    }, 1000);
                });
            };
        } else {
            writeState.current = "mounted"
        }
        return () => {
            clearTimeout(writeState.current);
            db.collection("rooms").doc(roomID).set({
                [user.uid]: false,
            }, { merge: true })
        }
    }, [input, state]);

    /*useEffect(() => {
        if (roomID) {
            console.log("setting up roomID of the user with id: ", roomID);
            db.collection("users").doc(user.uid).set({
                onRoom: roomID
            }, { merge: true });
        }   
        
        return () => {
            console.log("clearing roomID of user");
            db.collection("users").doc(user.uid).set({
                onRoom: false
            }, { merge: true });  
        }
    }, [roomID]);*/

    useEffect(() => {
        const text = fileTexts.current[activeElement] ? fileTexts.current[activeElement] : "";
        setInput(text);
        document.querySelector(".chat__footer--input").value = text;
    }, [activeElement]);

    const clickImagePreview = useCallback((event, src, ratio) => {
        const target = event.target;
        const node = target.parentNode.parentNode;
        const obj = node.getBoundingClientRect();
        setImagePreview({
            ratio: ratio,
            top: page.transform === "scale(1)" ? obj.top : obj.top / (window.innerHeight / page.height),
            left: page.transform === "scale(1)" ? obj.left : obj.left / (window.innerWidth / page.width),
            width: node.offsetWidth,
            height: node.offsetHeight,
            imgW: target.offsetWidth,
            imgH: target.offsetHeight,
            src,
        })
    }, []);

    const close = useCallback((isSendingMessage) => {
        mediaPreview.current.style.animation = "opacity-out 300ms ease forwards";
        setTimeout(() => {
            setIsMedia(false);
            if (!isSendingMessage) {
                document.querySelector(".chat__footer--input").value = "";
                fileTexts.current = [];
                setImage([]);
                setSRC([]);
                setFiles([]);
            }
            setActiveElement(0);
        }, [310])
    }, []);

    const handleMedia = useCallback(event => {
        const { imageFiles, imagesSrc } = mediaIndexer(event.target.files);
        if (imagesSrc.length > 0) {
            setSRC(imagesSrc);
            setImage(imageFiles);
            setIsMedia("images");
        }
    }, []);

    const handleFile = useCallback(async event => {
        if (window.navigator.onLine) {
            if (event.target.files) {
                setIsMedia("loading");
                const { imagesSrc, imageFiles, files } = await fileIndexer(event.target.files);
                setSRC(imagesSrc);
                console.log(files);
                setImage(imageFiles);
                setFiles(files);
                setIsMedia("files");
            };
        } else {
            alert("No access to internet !!!");
        };
    }, []);

    useEffect(() => {
        const dropArea = document.querySelector(".chat");
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropArea.addEventListener(eventName, e => {
                e.preventDefault();
                e.stopPropagation();
            }, false);
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            dropArea.addEventListener(eventName, () => setShowDrag(true), false)
        });
        ['dragleave', 'drop'].forEach(eventName => {
            dropArea.addEventListener(eventName, () => setShowDrag(false), false)
        });

        dropArea.addEventListener('drop', e => {
            if (window.navigator.onLine) {
                if (e.dataTransfer?.files) {
                    const dropedFile = e.dataTransfer.files;
                    console.log("dropped file: ", dropedFile);
                    const { imageFiles, imagesSrc } = mediaIndexer(dropedFile);
                    setSRC(prevImages => [...prevImages, ...imagesSrc]);
                    setImage(prevFiles => [...prevFiles, ...imageFiles]);
                    setIsMedia("images_dropped");
                };
            };
        }, false);

    }, []);

    const outerHeight = useCallback(function (el) {
        if (el) {
            var height = el.offsetHeight;
            var style = getComputedStyle(el);

            height += parseInt(style.marginTop) + parseInt(style.marginBottom);
            return height;
        }
        return null;
    }, []);

    const sendMessage = useCallback(async event => {
        event.preventDefault();
        if (focus && image.length === 0) {
            document.querySelector('.chat__footer > form > .chat__footer--input').focus();
        }
        if (((fileTexts.current[0] === "" && image.length > 0) || fileTexts.current[0] !== "") && !sendingMessage.current) {
            sendingMessage.current = true;
            document.querySelector(".chat__footer--input").value = "";
            setInput("");
            image.length > 0 && close(true);
            const imageData = [];
            const operations = [];
            const j = image.length > 0 ? image.length : 1;
            for (let index = 0; index < j; index++) {//input
                const inputText = fileTexts.current[index] ? fileTexts.current[index] : "";
                const imageToUpload = image[index];
                const roomInfo = {
                    lastMessage: imageToUpload ? {
                        message: inputText,
                        audio: false,
                    } : inputText,
                    seen: false,
                }
                operations.push(db.collection("rooms").doc(roomID).set(roomInfo, { merge: true }));
                var split, imageName;
                if (imageToUpload) {
                    split = imageToUpload.name.split(".");
                    imageName = split[0] + uuidv4() + "." + split[1];
                }
                const messageToSend = imageToUpload ? {
                    name: user.displayName,
                    message: inputText,
                    uid: user.uid,
                    timestamp: createTimestamp(),
                    time: new Date().toUTCString(),
                    imageUrl: "uploading",
                    imageName: imageName,
                    ratio: ratio[index]
                } : {
                    name: user.displayName,
                    message: inputText,
                    uid: user.uid,
                    timestamp: createTimestamp(),
                    time: new Date().toUTCString(),
                }
                if (state.userID) {
                    operations.push(db.collection("users").doc(state.userID).collection("chats").doc(roomID).set({
                        timestamp: createTimestamp(),
                        photoURL: user.photoURL ? user.photoURL : /*`https://api.dicebear.com/8.x/fun-emoji/svg?seed=${roomID}`*/null,
                        name: user.displayName,
                        userID: user.uid,
                        unreadMessages: fieldIncrement(1),
                    }, { merge: true }).then(e => console.log(e)).catch(e => console.log(e)));
                    operations.push(db.collection("users").doc(user.uid).collection("chats").doc(roomID).set({
                        timestamp: createTimestamp(),
                        photoURL: state.photoURL ? state.photoURL : /*`https://api.dicebear.com/8.x/fun-emoji/svg?seed=${roomID}`*/null,
                        name: state.name,
                        userID: state.userID
                    }, { merge: true }));
                    if (token !== "" && !imageToUpload) {
                        operations.push(db.collection("notifications").add({
                            userID: user.uid,
                            title: user.displayName,
                            body: inputText,
                            photoURL: user.photoURL,
                            token: token,
                        }));
                    };
                } else {
                    operations.push(db.collection("users").doc(user.uid).collection("chats").doc(roomID).set({
                        timestamp: createTimestamp(),
                        photoURL: state.photoURL ? state.photoURL : /*`https://api.dicebear.com/8.x/fun-emoji/svg?seed=${roomID}`*/null,
                        name: state.name,
                    }));
                };
                if (image.length > 0) {
                    operations.push(wait(700));
                    const doc = await db.collection("rooms").doc(roomID).collection("messages").add(messageToSend);
                    await Promise.all(operations);
                    console.log("message ", index, "sent");
                    imageData[index] = {
                        doc,
                        imageToUpload,
                        imageName,
                        inputText
                    };
                } else {
                    db.collection("rooms").doc(roomID).collection("messages").add(messageToSend);
                }
            };
            //console.log("image data: ", imageData);
            fileTexts.current = [document.querySelector(".chat__footer--input").value];
            setImage([]);
            setSRC([]);
            if (imageData.length > 0) {
                for (const { imageName, doc, imageToUpload, inputText } of imageData) {
                    new Compressor(imageToUpload, {
                        quality: 0.8, maxWidth: 1920, async success(result) {
                            await storage.child(imageName).put(result);
                            const url = await storage.child(imageName).getDownloadURL();
                            db.collection("rooms").doc(roomID).collection("messages").doc(doc.id).update({
                                imageUrl: url
                            });
                            if (state.userID && token !== "") db.collection("notifications").add({
                                userID: user.uid,
                                title: user.displayName,
                                body: inputText,
                                photoURL: user.photoURL,
                                token: token,
                                image: url
                            });
                        }
                    });
                };
            };
            sendingMessage.current = false;
        };
    }, [focus, image, ratio, state, token]);

    const deleteRoom = useCallback(async () => {
        if (window.navigator.onLine) {
            setOpenMenu(false);
            setDeleting(true);
            try {
                const room = db.collection("rooms").doc(roomID);
                await room.set({
                    delete: true
                }, { merge: true });
                const fetchedMessages = await room.collection("messages").get();
                const fetchedAudios = [];
                const fecthedImages = [];
                fetchedMessages.docs.forEach(doc => {
                    if (doc.data().audioName) {
                        fetchedAudios.push(doc.data().audioName);
                    } else if (doc.data().imageName) {
                        fecthedImages.push(doc.data().imageName);
                    }
                });
                var usersChats = [];
                if (state.userID) {
                    usersChats = [state.userID, user.uid];
                } else {
                    usersChats = [...new Set(fetchedMessages.docs.map(cur => cur.data().uid))];
                };
                await Promise.all([
                    ...fetchedMessages.docs.map(doc => doc.ref.delete()),
                    ...fecthedImages.map(img => storage.child(img).delete()),
                    ...fetchedAudios.map(aud => audioStorage.child(aud).delete()),
                    ...usersChats.map(userChat => db.collection("users").doc(userChat).collection("chats").doc(roomID).delete()),
                    room.delete()
                ]);
                page.width <= 760 ? history.goBack() : history.replace("/chats");
            } catch (e) {
                console.log(e.message);
                page.width <= 760 ? history.goBack() : history.replace("/chats");
            };
        } else {
            alert("No access to internet !!!");
        };
    }, [state, page]);

    const handleFocus = useCallback(() => {
        if (chatBodyContainer.current.scrollTop > chatBodyContainer.current.scrollHeight - chatBodyContainer.current.offsetHeight - 120) {
            //console.log("handling focus");
            chatBodyContainer.current.scrollTop = chatBodyContainer.current.scrollHeight;
        };
    }, []);

    const fetchMessages = useCallback(function (update, messagesLength) {
        const ref = db.collection("rooms").doc(roomID).collection("messages").orderBy("timestamp", "desc");
        if (update) {
            return b.current[roomID] = ref.limit(5).onSnapshot(snapshot => {
                //window.addEventListener("offline", cancelListener);
                if (!disconnected.current) {
                    console.log("disconnected: ", disconnected);
                    const newMessages = snapshot.docs.map(doc => {
                        const data = doc.data();
                        const time = data.time ? data.time : new Date(data.timestamp?.toDate()).toUTCString()
                        return {
                            ...data,
                            timestamp: time,
                            id: doc.id,
                        }
                    });
                    newMessages.reverse();
                    dispatch({
                        type: actionTypes.SET_MESSAGES,
                        id: roomID,
                        messages: newMessages,
                        update
                    });
                } else {
                    b.current[roomID]();
                    disconnected.current = false;
                }
            });
        } else {
            return ref.limit(messagesLength ? messagesLength + 6 : limit.current).get().then(docs => {
                const newMessages = [];
                docs.forEach(doc => {
                    const data = doc.data();
                    const time = data.time ? data.time : new Date(data.timestamp?.toDate()).toUTCString()
                    newMessages.push({
                        ...data,
                        timestamp: time,
                        id: doc.id,
                    });
                });
                newMessages.reverse();
                /*console.log("messages length: ", messagesLength)
                console.log("fetched messages: ", newMessages);*/
                dispatch({
                    type: actionTypes.SET_MESSAGES,
                    id: roomID,
                    messages: newMessages,
                    update
                });
            });
        };
    }, []);

    useEffect(() => {
        if (roomOnline[roomID]) {
            window.removeEventListener("online", roomOnline[roomID]);
        }
        const onOnline = () => {
            console.log("chat is online");
            b.current[roomID] && b.current[roomID]();
            fetchMessages(false, prevMessages.current.length);;
            fetchMessages(true);
        }
        window.addEventListener("online", onOnline);
        roomOnline[roomID] = onOnline;
    }, [roomID]);

    const paginate = useCallback(function () {
        if (chatBodyContainer.current?.scrollTop <= 300 && !limitReached && !paginating.current) {
            setPaginateLoader(true);
            prevScrollHeight.current = chatBodyContainer.current.scrollHeight;
            paginating.current = true;
            paginating2.current = true;
            limit.current = messages.length + limit.current;
            fetchMessages(false);
        } else if (paginating2.current) {
            prevScrollHeight.current = chatBodyContainer.current.scrollHeight - chatBodyContainer.current.scrollTop;
        };
    }, [limitReached, messages]);

    useEffect(() => {
        if (messages.length > 0 && !deleting) {
            if (messages[messages.length - 1].id !== prevMessages.current[prevMessages.current?.length - 1]?.id && dispatchMessages[roomID]?.audio) {
                if (messages[messages.length - 1].uid !== user.uid && !paginating2.current && (messages[messages.length - 1].imageUrl === "uploading" || !messages[messages.length - 1].imageUrl)) {
                    messageReceivedAudio.current.play();
                } else if (messages[messages.length - 1].uid === user.uid && !paginating2.current && (messages[messages.length - 1].imageUrl === "uploading" || !messages[messages.length - 1].imageUrl) && (messages[messages.length - 1].audioUrl === "uploading" || !messages[messages.length - 1].audioUrl)) {
                    messageSentAudio.current.play();
                };
            };

        };
    }, [messages, deleting, dispatchMessages[roomID]]);

    useEffect(() => {
        if (firstRender && !limitReached) {
            chatBodyContainer.current.addEventListener("scroll", paginate);
        };
        const clean = chatBodyContainer.current;
        return () => {
            clean.removeEventListener("scroll", paginate);
        };
    }, [firstRender, limitReached]);


    useEffect(() => {
        if (limitReached !== dispatchMessages[roomID]?.limitReached) {
            //console.log("setting limit reached: ", Boolean(dispatchMessages[roomID]?.limitReached));
            setLimitReached(Boolean(dispatchMessages[roomID]?.limitReached));
        }
    }, [dispatchMessages[roomID]], limitReached);

    useLayoutEffect(() => {
        //console.log("paginating: ", paginating.current)
        if (messages.length > 0 && paginating.current) {
            if (paginating.current && messages.length > prevMessages.current?.length) {
                console.log("scroll for paginating")
                chatBodyContainer.current.scrollTop = chatBodyContainer.current.scrollHeight - prevScrollHeight.current;
                prevScrollTop.current = chatBodyContainer.current.scrollHeight - prevScrollHeight.current;
                paginating.current = false;
                setPaginateLoader(false);
            };
        };
    }, [messages]);

    useLayoutEffect(() => {
        if (messages.length > 0) {
            const nodeArr = Array.from(document.querySelectorAll('.chat__message'));
            const height = outerHeight(nodeArr[nodeArr.length - 2]) + outerHeight(nodeArr[nodeArr.length - 3]) + outerHeight(nodeArr[nodeArr.length - 4]);
            setLastMHeight(height < page.height / 2 ? height : page.height / 2);
        };
    }, [messages]);

    const messageScroll = useCallback(() => {
        setSendAnim(true);
        //const lastElementHeight = document.querySelector(".chat__lastMessage").offsetHeight;
        const fullScroll = chatBodyContainer.current.scrollHeight - chatBodyContainer.current.scrollTop > chatBodyContainer.current.offsetHeight * 2;
        console.log("fullScroll: ", fullScroll);
        smoothScroll({
            element: chatBodyContainer.current,
            duration: fullScroll ? 100 : 200,
            fullScroll,
            halfScroll: fullScroll,
            exitFunction: () => {
                if (fullScroll) {
                    smoothScroll({
                        element: chatBodyContainer.current,
                        duration: 200,
                        fullScroll,
                        halfScroll: false,
                        exitFunction: () => {
                            setSendAnim(false);
                        }
                    });
                } else {
                    setSendAnim(false);
                }
            }
        });
    }, [firstRender]);

    const scrollChatBody = useCallback(() => {
        const lastNode = document.querySelector(".chat__lastMessage");
        const chatBodyHeight = chatBodyContainer.current.scrollHeight - chatBodyContainer.current.clientHeight;
        /*console.log("chat body scroll height from scrollChatBody: ", chatBodyContainer.current.scrollHeight);
        console.log("chat body client height from scrollChatBody: ", chatBodyContainer.current.clientHeight);
        console.log("chat body scroll top from scrollChatBody: ", chatBodyContainer.current.scrollTop);
        console.log("chat body element: ", chatBodyRef.current);*/
        if (chatBodyHeight === 0) {
            setTimeout(() => {
                if (chatBodyRef.current) {
                    chatBodyRef.current.style.opacity = "1";
                }
                !firstRender && setFirstRender(true)
            }, animState === "entering" ? 310 : 50);
            setTimeout(() => {
                if (lastNode) {
                    lastNode.style.animation = "none";
                    lastNode.style.opacity = "1";
                }
            }, 50)
        } else if (chatBodyContainer.current.scrollTop + outerHeight(lastNode) >= chatBodyHeight - lastMHeight
            && messages[messages.length - 1].uid !== user.uid && firstRender) {
            if (chatBodyContainer.current.scrollTop !== chatBodyContainer.current.scrollHeight) {
                console.log("scrolling down 1");
                messageScroll()
            };
        } else if (messages[messages.length - 1].uid === user.uid && firstRender) {
            if (chatBodyContainer.current.scrollTop !== chatBodyContainer.current.scrollHeight) {
                console.log("scrolling down 2");
                messageScroll();
            };

        } else {
            setScrollArrow(true);
        };
    }, [firstRender, animState, lastMHeight, messages, messageScroll]);

    useEffect(() => {
        if (messages.length > 0) {
            if (!firstRender && chatBodyContainer.current.scrollHeight - chatBodyContainer.current.clientHeight !== 0 && Object.keys(collapse).length !== 0) {
                console.log("scrolled down");
                chatBodyContainer.current.scrollTop = chatBodyContainer.current.scrollHeight;
                setTimeout(() => {
                    const node = document.querySelector(".chat__lastMessage");
                    if (node) {
                        node.style.animation = "none";
                        node.style.opacity = "1";
                    };
                    setTimeout(() => {
                        setFirstRender(true);
                    }, 200);
                }, 50);
            } else {
                /*console.log("messages: ", messages);
                console.log("previous messages: ", prevMessages.current);
                console.log("paginating2: ", paginating2.current)*/
                if (!paginating2.current && messages.length > prevMessages.current.length) {
                    scrollChatBody();
                };
            };
        }
    }, [messages, firstRender, collapse, scrollChatBody]);

    const updateScrollTop = useCallback(() => {
        const newScrollTop = chatBodyContainer.current.scrollHeight - chatBodyContainer.current.offsetHeight;
        console.log("new scroll top: ", newScrollTop)
        if (prevScrollTop.current && chatBodyContainer.current.scrollTop === chatBodyContainer.current.scrollHeight - chatBodyContainer.current.offsetHeight) {
            console.log("updating scroll top")
            chatBodyContainer.current.scrollTop = prevScrollTop.current;
        }
        console.log("prev scroll top: ", prevScrollTop.current);
        prevScrollTop.current = newScrollTop;
    }, []);

    useLayoutEffect(() => {
        updateScrollTop();
    }, [messages]);

    useEffect(() => {
        var a = () => {
            if (lastMHeight && chatBodyContainer.current.scrollTop <= (chatBodyContainer.current.scrollHeight - chatBodyContainer.current.offsetHeight - lastMHeight)) {
                setScrollArrow(true);
            } else {
                setScrollArrow(false);
            };
            if (chatBodyRef.current.style.opacity === "0" || chatBodyRef.current.style.opacity === "") {
                //console.log("chat opacity: '" + chatBodyRef.current.style.opacity + "'");
                const scrollHeight = chatBodyContainer.current.scrollHeight - chatBodyContainer.current.clientHeight;
                /*console.log("scrollHeight: ", scrollHeight);
                console.log("scrollTop without round: ", chatBodyContainer.current.scrollTop);*/
                if (Math.round(chatBodyContainer.current.scrollTop) >= scrollHeight) {
                    setTimeout(() => {
                        //console.log("setting opacity 1 with animState: ", animState);
                        chatBodyRef.current.style.opacity = "1";
                    }, animState === "entering" ? 310 : 50);
                };
            };
            if (messages.length > 0) {
                if (chatBodyContainer.current.scrollTop > chatBodyContainer.current.scrollHeight - chatBodyContainer.current.offsetHeight - 180) {
                    if (state.userID) {
                        if (unreadMessages !== 0) {
                            db.collection("users").doc(user.uid).collection("chats").doc(roomID).set({
                                unreadMessages: 0,
                            }, { merge: true });
                        }
                        if (!seen && messages[messages.length - 1].uid !== user.uid) {
                            db.collection("rooms").doc(roomID).set({
                                seen: true,
                            }, { merge: true });
                        };
                    };
                };
            };
        };
        chatBodyContainer.current.addEventListener('scroll', a);
        const ref = chatBodyContainer.current;

        return () => {
            ref.removeEventListener("scroll", a)
        }
    }, [messages, state, user.uid, roomID, seen, animState, lastMHeight, unreadMessages]);

    useLayoutEffect(() => {
        if (messages.length > 0) {
            setCollapse(prevCollapse => {
                var newCollpase = { initialCollapse: true };
                var noCollapse = prevCollapse.initialCollapse;
                Array.from(document.querySelectorAll(".chat__transcript")).forEach(el => {
                    if (!prevCollapse[el.dataset.id]) {
                        if (el.clientWidth < el.scrollWidth) {
                            noCollapse = false;
                            newCollpase[el.dataset.id] = true;
                        };
                    };
                });
                return noCollapse ? prevCollapse : {
                    ...prevCollapse,
                    ...newCollpase
                };
            });
        };
    }, [messages]);

    const listenToImg = useCallback(function (docID) {
        return db.collection("rooms").doc(roomID).collection("messages").doc(docID).onSnapshot(doc => {
            //console.log("image snap set");
            const { imageUrl } = doc.data();
            if (imageUrl !== "uploading") {
                //console.log("dispatching the image");
                dispatch({
                    type: "update_media",
                    roomID: roomID,
                    id: docID,
                    data: { imageUrl }
                });
                //console.log("unsubscribing from image snap: ", docID);
                mediaSnap.current = mediaSnap.current.filter(cur => {
                    if (cur.id !== docID) {
                        return true;
                    }
                    cur.snap();
                    return false;
                });
            };
        });
    }, []);
    //user
    const listenToAudio = useCallback(function (docID) {
        //console.log("listen to audio function")
        const s = db.collection("rooms").doc(roomID).collection("messages").doc(docID).onSnapshot(doc => {
            //console.log("audio snap set");
            //console.log("audio data: ", doc.data());
            const data = doc.data();
            if (data) {
                const { audioUrl, audioPlayed, transcript } = doc.data();
                //console.log("transcript: ", transcript);
                if (audioUrl !== "uploading" || audioPlayed === true) {
                    console.log("dispatching audio");
                    dispatch({
                        type: "update_media",
                        roomID: roomID,
                        id: docID,
                        data: {
                            audioUrl,
                            audioPlayed,
                            transcript
                        }
                    });
                };
                if (audioUrl !== "uploading" && audioPlayed === true && transcript !== "$state=loading") {
                    console.log("unsubscribing from audio snap: ");
                    mediaSnap.current = mediaSnap.current.filter(cur => {
                        if (cur.id !== docID) {
                            return true;
                        };
                        cur.snap();
                        return false;
                    });
                }
            }
        });
        return s;
    }, []);

    useEffect(() => {
        return () => {
            dispatch({ type: "set_audio_false", id: roomID });
        };
    }, [roomID]);

    useEffect(() => {
        if (messages.length > 0 && firstRender && !mediaChecked.current) {
            //console.log("checking media");
            messages.forEach(cur => {
                if (cur.imageUrl === "uploading") {
                    //console.log("listening to an image");
                    const x = listenToImg(cur.id);
                    mediaSnap.current.push({
                        snap: x,
                        id: cur.id,
                    });
                } else if (cur.audioUrl === "uploading" || cur.audioPlayed === false || cur.transcript === "") {
                    //console.log("listening to audio");
                    const x = listenToAudio(cur.id);
                    mediaSnap.current.push({
                        snap: x,
                        id: cur.id,
                    });
                };
            });
            mediaChecked.current = true;
        } else if (messages.length > prevMessages.current.length && firstRender && mediaChecked.current) {
            console.log("updating new media")
            let init = 0;
            let stop = messages.length - prevMessages.length;
            if (prevMessages.current[0]?.id === messages[0].id) {
                init = prevMessages.current.length;
                stop = messages.length;
            }
            for (var i = init; i < stop; i++) {
                if (messages[i].imageUrl === "uploading") {
                    //console.log("listening to an image");
                    const x = listenToImg(messages[i].id);
                    mediaSnap.current.push({
                        snap: x,
                        id: messages[i].id,
                    });
                } else if (messages[i].audioUrl === "uploading" || messages[i].audioPlayed === false || messages[i].transcript === "") {
                    //console.log("listening to audio");
                    const x = listenToAudio(messages[i].id);
                    mediaSnap.current.push({
                        snap: x,
                        id: messages[i].id,
                    });
                };
            };
        };
    }, [messages, firstRender]);

    useEffect(() => {
        return () => {
            //console.log("cleaning media snap");
            mediaSnap.current.forEach(cur => cur.snap());
            setFirstRender(false)
        };
    }, [roomID]);

    useEffect(() => {
        paginating2.current = paginating.current;
        prevMessages.current = [...messages];
        //console.log("setting new messages: ", prevMessages.current)
    }, [messages]);

    useEffect(() => {
        if (roomID && !deleting) {
            if (b.current[roomID]) {
                //console.log("snapshot listener already exists");
                b.current[roomID]();
            }
            //console.log("first message from fetch effect: ", dispatchMessages[roomID]?.firstMessageID);
            if (dispatchMessages[roomID]?.firstMessageID) {
                fetchMessages(true);
            } else {
                db.collection("rooms").doc(roomID).collection("messages").orderBy("timestamp", "asc").limit(1).get().then(docs => {
                    //console.log("doc: ", docs);
                    if (docs.empty) {
                        dispatch({
                            type: "set_firstMessage",
                            id: roomID,
                            firstMessageID: "no id",
                        });
                    } else {
                        docs.forEach(doc => {
                            //console.log("doc.exists: ", doc.exists);
                            //console.log("first document id: ", doc.id);
                            //console.log("first document data: ", doc.data());
                            dispatch({
                                type: "set_firstMessage",
                                id: roomID,
                                firstMessageID: doc.id,
                            });
                        });
                    };
                    fetchMessages(false);
                    fetchMessages(true);
                });
            };
        };
    }, [roomID, deleting]);

    useEffect(() => {
        setClientWidth(document.querySelector('.chat__body--container').clientWidth)
    }, [page]);
    //window
    useEffect(() => {
        if (page.initial && page.width < page.height) {
            if (animState === "entering") {
                setTimeout(() => {
                    document.querySelector(".chat").classList.add('chat-animate');
                }, 0);
            } else if (animState === "exiting") {
                setTimeout(() => {
                    document.querySelector(".chat")?.classList.remove('chat-animate');
                }, 0);
            };
        };
    }, [animState, page])

    useEffect(() => {
        if (!location.state && roomID) {
            const userID = roomID?.replace(user.uid, "");
            db.collection("users").doc(userID).get().then(doc => {
                const data = doc.data();
                setState(data?.name ? {
                    name: data.name,
                    photoURL: data.photoURL,
                    userID,
                } : {
                    userID,
                })
            })
        } else {
            setState(location.state)
        }
    }, [location.state, roomID])

    useEffect(() => {
        var h = null;
        if (state?.userID) {
            h = db.collection("users").doc(state.userID).onSnapshot(doc => {
                if (doc.data()?.token) {
                    setToken(doc.data().token);
                };
            });
        };

        return () => {
            h && h();
        }
    }, [state]);

    useEffect(() => {
        if (roomID && state?.userID) {
            var h = db.collection("rooms").doc(roomID).onSnapshot(snap => {
                if (snap.data()) {
                    setTyping(snap.data()[state.userID]);
                }
            })
        }

        return () => {
            if (h) h();
        }
    }, [roomID, state])

    useEffect(() => {
        if (roomID) {
            var z = db.collection("rooms").doc(roomID).onSnapshot(snap => {
                setSeen(snap.data()?.seen);
            });
        };

        return () => {
            if (z) {
                z();
            }
        }
    }, [roomID]);

    //setting seen and unreadMessages when chat is unscrollable
    useEffect(() => {
        if (messages.length > 0) {
            if (chatBodyContainer.current.scrollHeight - chatBodyContainer.current.offsetHeight === 0 && messages[messages.length - 1].uid !== user.uid) {
                db.collection("rooms").doc(roomID).set({
                    seen: true,
                }, { merge: true });
            };
        };
    }, [messages]);

    useEffect(() => {
        if (messages.length > 0) {
            if (chatBodyContainer.current.scrollHeight - chatBodyContainer.current.offsetHeight === 0
                && state.userID) {
                db.collection("users").doc(user.uid).collection("chats").doc(roomID).set({
                    unreadMessages: 0,
                }, { merge: true });
            }
        }
    }, [messages, state]);

    useEffect(() => {
        if (dispatchMessages[roomID]?.messages) {
            setMessages(dispatchMessages[roomID].messages);
        };
    }, [dispatchMessages[roomID]]);

    useEffect(() => {
        var h;
        if (state?.userID) {
            h = db.collection("users").doc(state.userID).collection("call").doc("call").onSnapshot(doc => {
                const data = doc.data();
                if (data) {
                    if (data.callerID && !data.otherUserLeft) {
                        setOtherUserInCall(true);
                    } else {
                        setOtherUserInCall(false);
                    };
                } else {
                    setOtherUserInCall(false);
                }
            });
        };

        return () => {
            h && h();
        }
    }, [state]);

    const collapseTranscript = useCallback(event => {
        const transcript = event.target.previousElementSibling;
        const height = transcript.scrollHeight;
        if (transcript.style.whiteSpace === "nowrap" || transcript.style.whiteSpace === "") {
            transcript.style.whiteSpace = "normal";
            transcript.style.maxHeight = height + "px";
            event.target.innerText = "hide transcript"
            setTimeout(() => {
                transcript.style.maxHeight = transcript.scrollHeight + "px";
            }, 10);
        } else if (transcript.style.whiteSpace === "normal") {
            transcript.style.whiteSpace = "nowrap";
            const height2 = transcript.scrollHeight;
            transcript.style.whiteSpace = "normal";
            transcript.style.maxHeight = height + "px";
            event.target.innerText = "show transcript"
            setTimeout(() => {
                transcript.style.maxHeight = height2 + "px";
                setTimeout(() => {
                    transcript.style.whiteSpace = "nowrap";
                }, 205)
            }, 10);
        }
    }, []);

    const scrollDown = useCallback(function () {
        smoothScroll({
            element: chatBodyContainer.current,
            duration: 100,
            fullScroll: true,
            halfScroll: true,
            exitFunction: () => {
                smoothScroll({
                    element: chatBodyContainer.current,
                    duration: 100,
                    fullScroll: true
                });
            }
        });
    }, []);

    const mediaCall = useMemo(() => {
        if (!call && !otherUserInCall && state.userID) {
            return (audio) => startVideoCall(dispatch, db.collection("users").doc(state.userID).collection("call").doc("call"),
                db.collection("users").doc(user.uid).collection("call").doc("call"), user.uid, state.userID, user.displayName, state?.name, token ? () => db.collection("notifications").add({
                    userID: user.uid,
                    title: user.displayName,
                    body: audio ? "📞 Incoming Audio Call..." : "🎥 Incoming Video Call...",
                    photoURL: user.photoURL,
                    token: token,
                }) : null, user.photoURL, state.photoURL, audio);
        };
        return null;
    }, [call, state, user, token, otherUserInCall]);

    const urlify = useCallback((text) => {
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        return text.replace(urlRegex, (url) => `<a target="_blank" href="${url}">${url}</a>`);
    }, []);

    /*useEffect(() => {
        if (match.url === "/") {
            setDeletePath("");
        } else {
            setDeletePath(match.url.replace("/image", "").replace("/call", ""));
        }

        return () => {
            setDeletePath("");
        }
    }, [match]);*/

    return (
        <>
            <div style={!roomID ? { display: "none" } : {}} ref={chatAnim} className="chat">
                <div style={{
                    height: page.height,
                    background: `url(${bg})`
                }} className="chat__background">

                </div>
                <Backdrop
                    sx={{ backgroundColor: '#00000052', zIndex: 6 }}
                    open={showDrag}
                >
                    <h1 className="backdrop__title">Drop Here</h1>
                </Backdrop>
                <div className="chat__header">
                    {page.width <= 760 ?
                        <IconButton onClick={() => setTimeout(() => history.goBack(), 250)}>
                            <ArrowBack sx={{ width: 15, height: 15 }} />
                            <div className="avatar__container">
                                <Avatar sx={{ width: 30, height: 30 }} src={state?.photoURL} />
                                {roomsData[roomID]?.onlineState === "online" ? <div className="online online__chat--avatar"></div> : null}
                            </div>

                        </IconButton>
                        :
                        <div className="avatar__container">
                            <Avatar sx={{ width: 35, height: 35 }} src={state.photoURL} />
                            {roomsData[roomID]?.onlineState === "online" ? <div className="online"></div> : null}
                        </div>
                    }
                    <div className="chat__header--info">
                        <h3 style={page.width <= 760 ? { width: page.width - 213 } : {}}>{state?.name} </h3>
                        <p style={page.width <= 760 ? { width: page.width - 213 } : {}}>{state.userID ? typing === "recording" ? "Recording ..." : typing ? "Typing ..." : messages?.length > 0 ? "Seen at " + messages[messages.length - 1]?.timestamp : "" : ""} </p>
                    </div>

                    <div className="chat__header--right">
                        <IconButton onClick={mediaCall && !otherUserDelete ? () => mediaCall(false) : null}>
                            <VideocamRounded sx={{
                                color: mediaCall && !otherUserDelete ? "auto" : "#A9A9A9"
                            }} />
                        </IconButton>
                        <IconButton onClick={mediaCall && !otherUserDelete ? () => mediaCall(true) : null}>
                            <CallRounded sx={{
                                color: mediaCall && !otherUserDelete ? "auto" : "#A9A9A9"
                            }} />
                        </IconButton>
                        <IconButton aria-controls="menu" aria-haspopup="true" onClick={state.userID || isAdmin ? event => setOpenMenu(event.currentTarget) : null}>
                            <MoreVert sx={{
                                color: state.userID || isAdmin ? "auto" : "#A9A9A9"
                            }} />
                        </IconButton>
                        <Menu
                            anchorEl={openMenu}
                            id={"menu"}
                            open={Boolean(openMenu)}
                            onClose={() => setOpenMenu(null)}
                        >
                            <MenuItem onClick={deleteRoom}>Delete Room</MenuItem>
                        </Menu>
                    </div>
                </div>

                <div className="chat__body--container" ref={chatBodyContainer}>
                    <div className="chat__body" ref={chatBodyRef}>
                        <div
                            className="loader__container paginateLoader"
                            style={{
                                height: !limitReached ? 70 : 30,
                            }}
                        >
                            {paginateLoader && !limitReached ? <CircularProgress /> : null}
                        </div>
                        <Messages
                            messages={messages}
                            clientWidth={clientWidth}
                            page={page}
                            seen={seen}
                            lastMessageRef={lastMessageRef}
                            state={state}
                            clickImagePreview={clickImagePreview}
                            audioList={audioList}
                            roomID={roomID}
                            animState={animState}
                            setAudioID={setAudioID}
                            audioID={audioID}
                            urlify={urlify}
                            collapse={collapse}
                            collapseTranscript={collapseTranscript}
                        />
                        {messages.length > 0 ?
                            <CSSTransition
                                in={seen && messages[messages.length - 1].uid === user.uid}
                                timeout={200}
                                classNames="seen-animate"
                                appear={true}
                            >
                                <p className="seen" >
                                    <p><span>Seen <DoneAllRounded /></span></p>
                                </p>
                            </CSSTransition>
                            : null}
                    </div>
                </div>
                {isMedia ?
                    <MediaPreview files={files} isMedia={isMedia} activeElement={activeElement} setActiveElement={setActiveElement} setRatio={setRatio} close={close} mediaPreview={mediaPreview} setSRC={setSRC} setImage={setImage} imageSRC={src} />
                    : null}

                <ChatFooter
                    input={input}
                    handleFocus={handleFocus}
                    change={!otherUserDelete ? change : null}
                    sendMessage={!otherUserDelete ? sendMessage : null}
                    setFocus={setFocus}
                    image={image}
                    focus={focus}
                    state={state}
                    token={token}
                    roomID={roomID}
                    setAudioID={setAudioID}
                    handleFile={handleFile}
                    sendingMessage={sendingMessage}
                    handleMedia={!otherUserDelete ? handleMedia : null}
                />
                <div></div>

                <CSSTransition
                    in={firstRender && scrollArrow && !sendAnim}
                    classNames="scroll"
                    timeout={310}
                    unmountOnExit
                >
                    <div className="scroll" onClick={scrollDown}
                    >
                        <ArrowDownward style={{
                            width: 22,
                            height: 22,
                            color: "black",
                        }} />
                        {unreadMessages ? <div><span>{unreadMessages}</span></div> : null}
                    </div>
                </CSSTransition>
                {deleting ?
                    <div className="chat__deleting">
                        <CircularProgress />
                    </div> : null
                }
            </div>
            {/*<TransitionGroup component={null}>
                <Transition
                    key={location.pathname}
                    timeout={{
                        appear: 250,
                        enter: 250,
                        exit: 250,
                    }}
                    classNames="zabi"
                >
                    {state => (
                        <Route location={location} path={match.url +  "/delete"} render={() => <DeleteUser animState={state} />} />
                    )}
                </Transition>
            </TransitionGroup>*/}
            <TransitionGroup component={null}>
                <Transition
                    timeout={{
                        appear: 310,
                        enter: 310,
                        exit: 410,
                    }}
                    classNames="page"
                    key={location.pathname}
                >
                    {animState => (
                        <Route path={match.url + "/image"} location={location}>
                            <ImagePreview
                                imagePreview={imagePreview}
                                animState={animState}
                            />
                        </Route>
                    )}
                </Transition>
            </TransitionGroup>
        </>
    );
};

export default memo(Chat);