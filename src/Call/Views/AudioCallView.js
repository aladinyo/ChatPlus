import React, { memo, useEffect, useRef, useMemo, useState, useCallback } from 'react';
import { useStateValue } from '../../StateProvider';
import useFadeAnimation from './hooks/useFadeAnimation';
import { dragElement } from './util';
import Avatar from '@mui/material/Avatar';
import Btn from './Buttons/Btn';
import RedPhone from './Buttons/RedPhone';
import CallIcon from '@mui/icons-material/Call';
import MicRoundedIcon from '@mui/icons-material/MicRounded';
import MicOffRoundedIcon from '@mui/icons-material/MicOffRounded';
import callAudioPath from "./Media/call.mp3";
import "./AudioCall.css";
/*const imageLink = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=764&q=80"
const imageAlt = "Alaa Eddine Boubekeur";*/

function pad(val) {
    var valString = val + "";
    if (valString.length < 2) {
        return "0" + valString;
    } else {
        return valString;
    }
}

export default memo(function ({ startLeavingCall, setCallFlow, executeFadeOut, setExecuteFadeOut, acceptCall, callFlow, isMicMuted }) {
    const [{ page, call, callState, callQueries, caller, callItems, otherUserName, photo }] = useStateValue();
    const [timer, setTimer] = useState("00:00");
    const audiocallRef = useRef();
    const timerInterval = useRef(null);
    const savedPhoto = useRef(photo);
    const audioEl = useRef();
    const fade = useFadeAnimation(audiocallRef, 250);
    const callAudio = useRef(new Audio(callAudioPath));

    const startTimer = useCallback(() => {
        const start = Date.now();
        timerInterval.current = setInterval(setTime, 100);

        function setTime() {
            const delta = Date.now() - start; // milliseconds elapsed since start
            const totalSeconds = Math.floor(delta / 1000);
            setTimer(pad(parseInt(totalSeconds / 60)) + ":" + pad(totalSeconds % 60))
        }
    }, []);

    const redPhoneClick = useCallback(() => {
        startLeavingCall();
        fade.animateFadeOut(() => setCallFlow(null));
        callAudio.current.pause();
    }, [startLeavingCall, fade]);

    const greenCameraClick = useCallback(() => {
        acceptCall(callQueries.receiverQuery);
        setCallFlow("audio_call");
        console.log("call audio: ", callAudio.current);
        callAudio.current.pause();
    }, [callQueries, acceptCall, fade]);

    useEffect(() => {
        callAudio.current.loop = true;
        callAudio.current.muted = false;
        callAudio.current.play();

        return () => {
            callAudio.current.pause();
        }
    }, []);

    useEffect(() => {
        if (callFlow === "audio_call") {
            callAudio.current.pause();
            startTimer();
        };

        return () => {
            timerInterval.current && clearInterval(timerInterval.current);
        }
    }, [callFlow])

    useEffect(() => {
        const clean = audiocallRef.current && dragElement(audiocallRef.current, page);

        return () => {
            clean && clean();
        }
    }, [page]);

    useEffect(() => {
        if (executeFadeOut === "leave") {
            startLeavingCall();
            fade.animateFadeOut(() => {
                setCallFlow(null);
                setExecuteFadeOut(false);
            })
        } else if (executeFadeOut === "joined") {
            callAudio.current.pause();
            setCallFlow("audio_call");
            setExecuteFadeOut(false);
        };

    }, [executeFadeOut, startLeavingCall, fade]);

    const audioTrack = useMemo(() => {
        if (callFlow === "audio_call") {
            console.log("call flow is audio call");
            if (callItems.otherUser) {
                console.log("other user exists");
                return callItems.otherUser.audioTrackState && callItems.otherUser.audioTrackState.state === 'playable'
                    ? callItems.otherUser.audioTrackState.track
                    : null;
            }
        }
        return null;

    }, [callItems.otherUser?.audioTrackState, callFlow]);

    useEffect(() => {
        audioEl.current && (audioEl.current.srcObject = new MediaStream([audioTrack]));
    }, [audioTrack]);

    const textWidth = useMemo(() => ({ width: page.width <= 760 ? page.width * 0.7 - 150 : null }), [page]);

    return (
        <div ref={audiocallRef} className="audiocall">
            {audioTrack && <audio autoPlay playsInline ref={audioEl} />}
            <div className="audiocall__info">
                <Avatar src={savedPhoto.current} alt={otherUserName} sx={{
                    width: page.width > 760 ? 60 : 40,
                    height: page.width > 760 ? 60 : 40
                }} />
                <div className="audiocall__text">
                    <p style={textWidth} className="audiocall__info--name">{otherUserName}</p>
                    <p style={textWidth} className="audiocall__info--time">
                        {callFlow !== "audio_call" ? caller ? "Calling..." : "Incoming Call..." : timer}
                    </p>
                </div>
            </div>
            <div className="audiocall__buttons">
                {!caller && callFlow === "start_audio_call" ?
                    <Btn classNames="greenCamera" onClick={callState === "state_joined" ? greenCameraClick : null}>
                        <CallIcon />
                    </Btn>
                    : callFlow === "audio_call" ?
                        <Btn onClick={() => call.setLocalAudio(isMicMuted)}>
                            {isMicMuted ? <MicOffRoundedIcon /> : <MicRoundedIcon />}
                        </Btn>
                        : null}
                <RedPhone onClick={callState === "state_joined" ? redPhoneClick : null} />
            </div>
        </div>
    )
});
