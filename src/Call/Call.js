import React, { useEffect, memo, useCallback, useState } from 'react';
import { useStateValue } from "../StateProvider";
import StartVideoCallView from './Views/StartVideoCallView';
import VideoCallView from './Views/VideoCallView';
import AudioCallView from './Views/AudioCallView';
import { logDailyEvent } from './Model/utils';
import { deleteRoom } from "./Model/api";
import db from '../firebase';
import joinCall from './Model/joinCall';
import VideoCallRoute from './Views/VideoCallRoute';

function Call() {
    const [{ call, callState, callRoom, user, callQueries, notifTimeout, otherUserRatio, callType }, dispatch] = useStateValue();
    const [callFlow, setCallFlow] = useState(null);
    const [executeFadeOut, setExecuteFadeOut] = useState(false);
    const [isCameraMuted, setIsCameraMuted] = useState(false);
    const [isMicMuted, setIsMicMuted] = useState(false);
    const [otherRatio, setOtherRatio] = useState(otherUserRatio);
    const [localRatio, setLocalRatio] = useState(window.screen.width / window.screen.height);

    const startLeavingCall = useCallback(() => {
        if (!call) return;
        // update component state to a "leaving" state...
        //update firestore
        if (callQueries) {
            callQueries.userQuery.delete();
            callQueries.receiverQuery.set({
                otherUserLeft: true
            }, { merge: true });
        }
        //this will fire the left meeting session event
        callRoom?.name && deleteRoom(callRoom.name);
        return call.leave();
    }, [call, callQueries, callRoom]);

    //a function that updates the database to joined call state
    const acceptCall = useCallback((receiverQuery, otherUserRatio) => {
        otherUserRatio && dispatch({ type: "set_other_user_ratio", otherUserRatio })
        receiverQuery.set({
            otherUserJoined: true,
        }, { merge: true });
        clearInterval(notifTimeout);
    }, [notifTimeout]);

    useEffect(() => {
        if (otherUserRatio) {
            setOtherRatio(otherUserRatio);
        }
    }, [otherUserRatio])

    useEffect(() => {
        var listener;
        if (user) {
            const userQuery = db.collection("users").doc(user.uid).collection("call").doc("call");
            listener = userQuery.onSnapshot((doc) => {
                //listen to changes in the call document of the local user
                const data = doc.data();
                if (data) {
                    if (data.otherUserLeft) {
                        //if other user left don't do anything
                        return;
                    } else {
                        const receiverQuery = db.collection("users").doc(data.callerID).collection("call").doc("call");
                        if (data.otherUserJoined) {
                            //accept call and join it when the other user joined
                            //console.log("other user joined !!!!")
                            acceptCall(receiverQuery, data.otherUserRatio);
                            //execute the animation
                            setExecuteFadeOut("joined");
                        } else if (!data.isCaller) {
                            dispatch({ type: "set_other_user_ratio", otherUserRatio: data.otherUserRatio });
                            //if you're not the caller then join the call from the snapshot listener
                            joinCall(dispatch, receiverQuery, userQuery, data.room, data.otherUserName, data.photo, data.callType);
                        };
                    };
                };
            });
        };
        return () => {
            listener && listener();
        }
    }, [user, acceptCall]);

    const callStateClean = useCallback(async () => {
        clearInterval(notifTimeout);
        dispatch({ type: "set_other_user_photo", photo: null});
        await call.destroy();
        // update component state to a "left" state...
        dispatch({ type: "set_call_room", callRoom: null });
        dispatch({ type: "set_call", call: null });
        dispatch({ type: "set_call_state", callState: "state_idle" });
        window.callDelete = null;
    }, [call, notifTimeout]);

    //listen to session changes
    useEffect(() => {
        if (!call) return;
        //console.log("call: ", call);
        const events = ["joined-meeting", "left-meeting", "error"];
        function handleNewMeetingState(event) {
            event && logDailyEvent(event);
            //console.log("meeting state: ", call.meetingState());
            switch (call.meetingState()) {
                case "joined-meeting":
                    // update component state to a "joined" state...
                    dispatch({ type: "set_call_state", callState: "state_joined" });
                    break;
                case "left-meeting":
                    callStateClean();
                    console.log("left meeting !!");
                    break;
                case "error":
                    // update component state to an "error" state...
                    console.log("meeting state error");
                    setExecuteFadeOut("leave");
                    callStateClean();
                    break;
                default:
                    break;
            }
        }
        // Use initial state
        handleNewMeetingState();
        // Listen for changes in state
        for (const event of events) {
            call.on(event, handleNewMeetingState);
        }
        // Stop listening for changes in state
        return function cleanup() {
            for (const event of events) {
                call.off(event, handleNewMeetingState);
            }
        }
    }, [call, callRoom, callStateClean]);

    //listen to participant changes
    useEffect(() => {
        if (!call) return;
        const events = ['participant-joined', 'participant-updated', 'participant-left'];
        function handleNewParticipantsState(event) {
            event && logDailyEvent(event);
            const participants = call.participants();
            if (event?.action === "participant-left") {
                //if a participant leaves leave the call
                console.log("participant left");
                clearInterval(notifTimeout);
                dispatch({ type: "set_other_user_photo", photo: null});
                setExecuteFadeOut("leave");
            } else {
                dispatch({
                    type: "participants_change",
                    participants: participants,
                });
            };
            if (event?.action === "participant-updated") {
                //console.log(event.action);
                //console.log(participants)
                if (participants.local) {
                    setIsCameraMuted(!participants.local.video);
                    setIsMicMuted(!participants.local.audio);
                };
            };
        };
        // Use initial state
        handleNewParticipantsState();
        // Listen for changes in state
        for (const event of events) {
            call.on(event, handleNewParticipantsState);
        }
        // Stop listening for changes in state
        return function cleanup() {
            for (const event of events) {
                call.off(event, handleNewParticipantsState);
            }
        };
    }, [call, notifTimeout]);


    //at the initial state of the call set the call flow to start video call
    useEffect(() => {
        console.log("call state", callState);
        if ((callState === "state_creating" || callState === "state_joining") && callFlow === null) {
            setCallFlow(callType === "audio" ? "start_audio_call" : "start_video_call");
        };
    }, [callState, callFlow, callType]);

    return (
        <>
            {callFlow === "start_video_call" ?
                <StartVideoCallView
                    setExecuteFadeOut={setExecuteFadeOut}
                    executeFadeOut={executeFadeOut}
                    setCallFlow={setCallFlow}
                    startLeavingCall={startLeavingCall}
                    acceptCall={acceptCall}
                    localRatio={localRatio}
                    setLocalRatio={setLocalRatio}
                />
            : callFlow === "video_call" ?
                <VideoCallView
                    isCameraMuted={isCameraMuted}
                    isMicMuted={isMicMuted}
                    setExecuteFadeOut={setExecuteFadeOut}
                    executeFadeOut={executeFadeOut}
                    setCallFlow={setCallFlow}
                    startLeavingCall={startLeavingCall}
                    localRatio={localRatio}
                    setLocalRatio={setLocalRatio}
                    otherRatio={otherRatio}
                    setOtherRatio={setOtherRatio}
                />
            : callFlow === "audio_call" || callFlow === "start_audio_call" ?
                <AudioCallView
                    startLeavingCall={startLeavingCall}
                    setCallFlow={setCallFlow}
                    executeFadeOut={executeFadeOut}
                    setExecuteFadeOut={setExecuteFadeOut}
                    acceptCall={acceptCall}
                    callFlow={callFlow}
                    isMicMuted={isMicMuted}
                />
            : null}
            <VideoCallRoute
                fullScreen
                isCameraMuted={isCameraMuted}
                isMicMuted={isMicMuted}
                setExecuteFadeOut={setExecuteFadeOut}
                executeFadeOut={executeFadeOut}
                setCallFlow={setCallFlow}
                startLeavingCall={startLeavingCall}
                localRatio={localRatio}
                setLocalRatio={setLocalRatio}
                otherRatio={otherRatio}
                setOtherRatio={setOtherRatio}
            />
        </>
    )
}

export default memo(Call);