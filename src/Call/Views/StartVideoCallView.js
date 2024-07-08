import React, { useEffect, useRef, memo, useMemo, useCallback } from 'react';
import RedPhone from './Buttons/RedPhone';
import GreenCamera from './Buttons/GreenCamera';
import { useStateValue } from '../../StateProvider';
import { dragElement } from "./util";
import useFadeAnimation from './hooks/useFadeAnimation';
import "./StartVideoCall.css";
import callAudioPath from "./Media/call.mp3";

export default memo(function StartVideoCallView({ startLeavingCall, executeFadeOut, setCallFlow, setExecuteFadeOut, acceptCall }) {
    const startVideoRef = useRef(null);
    const videoEl = useRef(null);
    const [{ page, callItems, caller, callQueries, callState, otherUserName }] = useStateValue();
    const fade = useFadeAnimation(startVideoRef, 250);
    const callAudio = useRef(new Audio(callAudioPath));

    const videoTrack = useMemo(() => {
        return callItems.local.videoTrackState && callItems.local.videoTrackState.state === 'playable'
            ? callItems.local.videoTrackState.track
            : null;
    }, [callItems.local.videoTrackState]);

    const redPhoneClick = useCallback(() => {
        startLeavingCall();
        fade.animateFadeOut(() => setCallFlow(null));
        callAudio.current.pause();
    }, [startLeavingCall, fade]);

    const greenCameraClick = useCallback(() => {
        acceptCall(callQueries.receiverQuery);
        fade.animateFadeOut(() => setCallFlow("video_call"));
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
        if (callState === "state_otherUser_calling") {
            fade.animateFadeOut(() => setCallFlow(null));
            callAudio.current.pause();
        }
    }, [callState, fade])

    useEffect(() => {
        if (executeFadeOut === "leave") {
            startLeavingCall();
            fade && fade.animateFadeOut(() => {
                setCallFlow(null);
                setExecuteFadeOut(false);
            })
        } else if (executeFadeOut === "joined") {
            fade && fade.animateFadeOut(() => {
                setCallFlow("video_call");
                setExecuteFadeOut(false);
            })
        }

    }, [executeFadeOut, startLeavingCall, fade]);

    useEffect(() => {
        videoEl.current && (videoEl.current.srcObject = new MediaStream([videoTrack]));
    }, [videoTrack]);

    useEffect(() => {
        const clean = startVideoRef.current && dragElement(startVideoRef.current, page);
        return () => {
            clean && clean();
        };
    }, [page]);

    const ratio = useMemo(() => {
        return window.screen.width / window.screen.height;
    }, [page]);

    const x = useMemo(() => {
        return page.width <= 760 ? page.width * 0.4 : 400;
    }, [page, ratio]);

    return (
        <div ref={startVideoRef} className="startVideoCall__container" style={{
            width: x,
            height: x / ratio
        }}>
            {videoTrack && <video className="startVideoCall__video" autoPlay muted playsInline ref={videoEl} />}
            <div className="startVideoCall__elements">
                <div className="startVideoCall__info">
                    <h1>{otherUserName}</h1>
                    <p>{caller ? "Calling..." : "Incoming Call"}</p>
                </div>
                <div className="startVideoCall__btn" style={{
                    width: !caller ? 96 : "auto"
                }}>
                    <RedPhone onClick={callState === "state_joined" ? redPhoneClick : null} />
                    {!caller && <GreenCamera onClick={callState === "state_joined" ? greenCameraClick : null} />}
                </div>
            </div>
        </div>
    );
});