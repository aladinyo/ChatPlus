import { useMemo, memo, useEffect, /*useRef, useLayoutEffect*/ } from 'react';
import { useStateValue } from './StateProvider';
import { Link } from 'react-router-dom/cjs/react-router-dom.js';
import { useRouteMatch } from 'react-router-dom';
import AudioPlayer from "./AudioPlayer.js"
import { CircularProgress } from '@mui/material';
import ErrorIcon from '@mui/icons-material/Error';

function Messages({ messages, clientWidth, page, seen, lastMessageRef, state, clickImagePreview, audioList, roomID, animState, setAudioID, audioID, urlify, collapse, collapseTranscript }) {
    const match = useRouteMatch();
    const [{ user }] = useStateValue();
    const widthRatio = useMemo(() => 0.7, []);
    /*const observer = useRef(new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = "1";
            } else {
                entry.target.style.opacity = "0";
            }
        });
    }, {
        threshold: 0,
        rootMargin: "+200px"
    }));

    useLayoutEffect(() => {
        var messagesNode = document.querySelectorAll(".chat__message");
        if (messages.length > 0) {
            messagesNode.forEach(messageElement => {
                observer.current.observe(messageElement);
            });
        }

        return () => {
            messagesNode.forEach(messageElement => {
                observer.current.unobserve(messageElement);
            });
        }
    }, [messages]);*/

    useEffect(() => {
        console.info(collapse)
    }, [collapse])

    return (
        <>
            {messages.map((message, i, messageArr) => {
                const messageTime = new Date(message.timestamp).toString().split(" ");
                var newDate = messageTime.slice(0, 1) + ", " + messageTime.slice(1, 4).join(" ");
                const time = messageTime[4].split(":").slice(0, -1).join(":");
                const previousMessageTime = i === 0 ? "" : new Date(messageArr[i - 1].timestamp).toString().split(" ");
                if (previousMessageTime) {
                    if (previousMessageTime.slice(0, 1) + ", " + previousMessageTime.slice(1, 4).join(" ") === newDate) {
                        newDate = "";
                    }
                }
                var mobileImageHeight = "";
                if (message.imageUrl) {
                    mobileImageHeight = (clientWidth * 0.9 - 60) * message.ratio;
                    if (mobileImageHeight > page.height * 0.35) {
                        mobileImageHeight = page.height * 0.35;
                    };
                };
                const style = {
                    marginTop: !messageArr[i - 1] ? 0 : message.uid !== messageArr[i - 1].uid ? newDate ? 0 : 30 : 8,
                }
                if (message.audioName) {
                    style.width = "320px";
                }
                if (!message.message) {
                    style.paddingBottom = "10px"
                }
                return (
                    <>
                        {newDate ?
                            <div style={{ marginTop: i === 0 ? 0 : 30 }} className="chat__time">
                                <div>
                                    <h2>{newDate}</h2>
                                </div>
                            </div>
                            : null}
                        <div style={style} ref={el => {
                            if (i === messages.length - 1 && !(seen && messages[messages.length - 1].uid === user.uid)) {
                                lastMessageRef.current = el;
                            };
                        }} key={message.id} className={`chat__message ${message.uid === user.uid && "chat__reciever"} ${i === messages.length - 1 ? "chat__lastMessage" : ""}`}>
                            <span className="chat__name">
                                {message.name}
                            </span>
                            {message.imageUrl && <div
                                style={page.width > 760 ? {
                                    width: clientWidth * widthRatio,
                                    height: message.ratio <= 1 ?
                                        clientWidth * widthRatio > 300 ?
                                            300 * message.ratio : clientWidth * widthRatio * message.ratio :
                                        clientWidth * widthRatio < 300 ? clientWidth * widthRatio : 300,
                                } : {
                                    width: clientWidth * 0.9 - 60,
                                    height: mobileImageHeight
                                }}
                                className="image-container"
                            >
                                {message.imageUrl === "error" ?
                                    <div className="image__container--loader error__container">
                                        <ErrorIcon />
                                        <h3>Error Uploading Image</h3>
                                    </div>
                                    : message.imageUrl === "uploading" ?
                                        <div className="image__container--loader">
                                            <CircularProgress size={page.width <= 760 ? 40 : 80} />
                                        </div>
                                        :
                                        <Link to={{
                                            pathname: match.url + "/image",
                                            state: state,
                                        }}>
                                            <img onClick={(e) => clickImagePreview(e, message.imageUrl, message.ratio)} src={message.imageUrl} alt="" />
                                        </Link>
                                }
                            </div>}
                            {message.audioName ?
                                <AudioPlayer audioName={message.audioName} audioList={audioList} sender={message.uid === user.uid} roomID={roomID} animState={animState} setAudioID={setAudioID} audioID={audioID} id={message.id} audioUrl={message.audioUrl} audioPlayed={message.audioPlayed} />
                                : <span dangerouslySetInnerHTML={{ __html: urlify(message.message) }} className="chat__message--message"></span>}
                            <span className="chat__timestamp">
                                {time}
                            </span>
                            {message.audioName ?
                                <>
                                    <p className="chat__transcript" data-id={message.id} style={{
                                        fontWeight: "normal",
                                        color: message.uid === user.uid ? "white" : "black"
                                    }}>
                                        {message.audioUrl === "error" ? "Error uploading audio" : message.transcript === "$state=loading" ? "transcripting audio..." : message.transcript ? message.transcript : "No Transcript"}
                                    </p>
                                    <p style={{
                                        color: message.uid === user.uid ? "#8edfff" : "#53ccfc",
                                        fontWeight: "bold"
                                    }} onClick={message.transcript !== "$state=loading" && message.transcript !== "" && collapse[message.id] ? collapseTranscript : null}
                                    className="transcript__collapse">
                                        {message.transcript === "$state=loading" ? "Converting Speech" : message.transcript !== "" 
                                        && collapse[message.id] ? "Show Transcript" : message.transcript !== "" && !collapse[message.id] ? "Transcripted" : "Speech not Recognized"}
                                    </p>
                                </>
                                : null}
                        </div>
                    </>
                )
            })}
        </>
    )
}

export default memo(Messages);