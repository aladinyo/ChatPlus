import React, { memo, useEffect, useState, useCallback, useRef, useMemo } from 'react';
import RedPhone from "./Buttons/RedPhone";
import Btn from './Buttons/Btn';
import VideocamOutlinedIcon from '@mui/icons-material/VideocamOutlined';
import MicRoundedIcon from '@mui/icons-material/MicRounded';
import MicOffRoundedIcon from '@mui/icons-material/MicOffRounded';
import OpenInFullRoundedIcon from '@mui/icons-material/OpenInFullRounded';
import CloseFullscreenRoundedIcon from '@mui/icons-material/CloseFullscreenRounded';
import CameraswitchRoundedIcon from '@mui/icons-material/CameraswitchRounded';
import VideocamOffRoundedIcon from '@mui/icons-material/VideocamOffRounded';
import { useHistory, useLocation } from 'react-router-dom';
import { useStateValue } from '../../StateProvider';
import { dragElement } from "./util";
import useFadeAnimation from './hooks/useFadeAnimation';
import "./VideoCall.css";

function VideoCallView({ animState, fullScreen, isMicMuted, isCameraMuted, startLeavingCall, setCallFlow, setExecuteFadeOut,
    executeFadeOut, localRatio, setLocalRatio, otherRatio, setOtherRatio }) {
    const [switchVideo, setSwitchVideo] = useState(false);
    const clean = useRef(true);
    const [{ page, callItems, call }] = useStateValue();
    const location = useLocation();
    const history = useHistory();
    const ref = useRef(null);
    const otherVideoEl = useRef(null);
    const localVideoEl = useRef(null);
    const audioEl = useRef(null);
    const fade = useFadeAnimation(ref, 250, fullScreen);

    const localVideoTrack = useMemo(() => {
        if (callItems.local) {
            return callItems.local.videoTrackState && callItems.local.videoTrackState.state === 'playable'
                ? callItems.local.videoTrackState.track
                : null;
        }
        return null;
    }, [callItems.local?.videoTrackState]);

    const otherVideoTrack = useMemo(() => {
        if (callItems.otherUser) {
            return callItems.otherUser.videoTrackState && callItems.otherUser.videoTrackState.state === 'playable'
                ? callItems.otherUser.videoTrackState.track
                : null;
        }
        return null;
    }, [callItems.otherUser?.videoTrackState]);

    const audioTrack = useMemo(() => {
        if (callItems.otherUser) {
            return callItems.otherUser.audioTrackState && callItems.otherUser.audioTrackState.state === 'playable'
                ? callItems.otherUser.audioTrackState.track
                : null;
        }
        return null;

    }, [callItems.otherUser?.audioTrackState]);

    const redPhoneClick = useCallback(() => {
        if (!fullScreen) {
            startLeavingCall();
            fade.animateFadeOut(() => setCallFlow(null));
        } else {
            clean.current = false;
            startLeavingCall();
            history.goBack();
            setCallFlow(null)
        };
    }, [startLeavingCall, fade, fullScreen]);

    useEffect(() => {
        const videoResize = e => {
            setLocalRatio(e.target.videoWidth / e.target.videoHeight);
        };
        if (localVideoEl.current) {
            localVideoEl.current.srcObject = new MediaStream([localVideoTrack]);
            localVideoEl.current.addEventListener("resize", videoResize);
        };
        return () => {
            localVideoEl.current && localVideoEl.current.removeEventListener("resize", videoResize);
        }
    }, [localVideoTrack]);

    useEffect(() => {
        const videoResize = e => {
            setOtherRatio(e.target.videoWidth / e.target.videoHeight);
        };
        if (otherVideoEl.current) {
            otherVideoEl.current.srcObject = new MediaStream([otherVideoTrack]);
            otherVideoEl.current.addEventListener("resize", videoResize);
        };
        return () => {
            otherVideoEl.current && otherVideoEl.current.removeEventListener("resize", videoResize);
        }
    }, [otherVideoTrack]);

    useEffect(() => {
        audioEl.current && (audioEl.current.srcObject = new MediaStream([audioTrack]));
    }, [audioTrack]);

    useEffect(() => {
        if (executeFadeOut === "leave") {
            startLeavingCall();
            if (!fullScreen) {
                fade.animateFadeOut(() => {
                    setCallFlow(null);
                    setExecuteFadeOut(false);
                });
            } else {
                clean.current = false;
                history.goBack();
                setCallFlow(null);
                setExecuteFadeOut(false);
            };
        };
    }, [executeFadeOut, fade, fullScreen, startLeavingCall]);

    useEffect(() => {
        if (fullScreen) {
            if (switchVideo) {
                if (localVideoEl.current) {
                    localVideoEl.current.style.top = "50%";
                    localVideoEl.current.style.left = "50%";
                    if (otherVideoEl.current) {
                        otherVideoEl.current.style.top = null;
                        otherVideoEl.current.style.left = null;
                    };
                }
            } else {
                if (otherVideoEl.current) {
                    otherVideoEl.current.style.top = "50%";
                    otherVideoEl.current.style.left = "50%";
                    if (localVideoEl.current) {
                        localVideoEl.current.style.top = null;
                        localVideoEl.current.style.left = null;
                    };
                }
            };
        };
    }, [page, fullScreen, switchVideo]);

    useEffect(() => {
        var clean = null;
        if (fullScreen) {
            if (switchVideo) {
                clean = otherVideoEl.current && dragElement(otherVideoEl.current, page);
            } else {
                clean = localVideoEl.current && dragElement(localVideoEl.current, page);
            };
        } else {
            clean = ref.current && dragElement(ref.current, page);
        };

        return () => {
            clean && clean();
        };
    }, [page, fullScreen, switchVideo, localVideoTrack, otherVideoTrack]);

    useEffect(() => {
        if (clean.current && fullScreen && animState === "exiting") {
            setCallFlow("video_call");
        }
    }, [fullScreen, animState]);

    const openFullScreen = useCallback(() => {
        const href = location.pathname !== "/" ? location.pathname.replace("/call", "") + "/call" : "/call";
        history.push(href);
        fade.animateFadeOut(() => {
            setCallFlow(null);
            setExecuteFadeOut(false);
        });
    }, [fade, history, location]);

    const closeFullScreen = useCallback(() => {
        history.goBack();
    }, [fade, history, location]);

    const x = useMemo(() => {
        return page.width < 760 ? page.width * 0.8 : page.width * 0.4;
    }, [page]);

    const largeVideoStyle = useMemo(() => {
        return !fullScreen ? {
            objectFit: "cover",
        } : {};
    }, [fullScreen]);

    const smallVideoStyle = useMemo(() => {
        const ratio = switchVideo ? otherRatio : localRatio;
        const ratio2 = switchVideo ? localRatio : otherRatio;
        const y = page.width / page.height < 1 ? 0.5 : 0.26;
        return fullScreen ? {
            width: ratio >= 1 ? page.width * y : page.width * y * ratio,
            height: ratio >= 1 ? page.width * y / ratio : page.width * y,
            borderRadius: 12 
        } : {
            width: ratio2 >= 1 ? x * 0.2 : x * 0.2 * ratio,
            height: ratio2 >= 1 ? x * 0.2 / ratio : x * 0.2,
            bottom: ratio2 < 1 ? "59px" : "11px"
        };
    }, [fullScreen, page, localRatio, x, otherRatio, switchVideo]);

    return (
        <div ref={ref} className="videocall" style={fullScreen ? {
            width: "100%",
            height: "100%",
            top: 0,
            left: 0,
            boxShadow: "none",
            borderRadius: 0,
            backgroundColor: "#ccc",
            zIndex: 6
        } : switchVideo ? {
            width: localRatio >= 1 ? x : x * localRatio,
            height: localRatio >= 1 ? x / localRatio : x
        } : {
            width: otherRatio >= 1 ? x : x * otherRatio,
            height: otherRatio >= 1 ? x / otherRatio : x
        }}>
            {otherVideoTrack && <video
                className={switchVideo ? "videocall__small" : "videocall__large"} autoPlay muted playsInline ref={otherVideoEl}
                style={switchVideo ? smallVideoStyle : largeVideoStyle}
            />}
            {localVideoTrack && <video
                className={switchVideo ? "videocall__large" : "videocall__small"} autoPlay muted playsInline ref={localVideoEl}
                style={switchVideo ? largeVideoStyle : smallVideoStyle}
            />}
            {audioTrack && <audio autoPlay playsInline ref={audioEl} />}
            <div className="videocall__top--section">
                {fullScreen ?
                    <Btn onClick={closeFullScreen}>
                        <CloseFullscreenRoundedIcon />
                    </Btn>
                    :
                    <Btn onClick={openFullScreen}>
                        <OpenInFullRoundedIcon />
                    </Btn>
                }
                <Btn onClick={() => setSwitchVideo(prevSwitch => !prevSwitch)}>
                    <CameraswitchRoundedIcon />
                </Btn>
            </div>
            <div className="videocall__bottom--section" style={!fullScreen && (!switchVideo && otherRatio < 1 || switchVideo && localRatio < 1) ? {
                left: 0,
                width: "100%",
                justifyContent: "space-around"
            } : {}}>
                <Btn onClick={() => call.setLocalVideo(isCameraMuted)}>
                    {isCameraMuted ? <VideocamOffRoundedIcon /> : <VideocamOutlinedIcon />}
                </Btn>
                <RedPhone onClick={redPhoneClick} />
                <Btn onClick={() => call.setLocalAudio(isMicMuted)}>
                    {isMicMuted ? <MicOffRoundedIcon /> : <MicRoundedIcon />}
                </Btn>
            </div>
        </div>
    )
};

export default memo(VideoCallView);