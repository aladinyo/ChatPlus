import DailyIframe from '@daily-co/daily-js';
import { nanoid } from 'nanoid';
import { createRoom, deleteRoom } from "./api";
import joinCall from './joinCall';
import db from '../../firebase';

export default async function startVideoCall(dispatch, receiverQuery, userQuery, id, otherID, userName, otherUserName, sendNotif, userPhoto, otherPhoto, audio) {
    var room = null;
    const call = new DailyIframe.createCallObject();
    const roomName = nanoid();
    window.callDelete = {
        id1: id,
        id2: otherID,
        roomName
    }
    dispatch({ type: "set_other_user_name", otherUserName });
    console.log("audio: ", audio);
    if (audio) {
        dispatch({ type: "set_other_user_photo", photo: otherPhoto });
        dispatch({ type: "set_call_type", callType: "audio" });
    } else {
        dispatch({ type: "set_other_user_photo", photo: null });
        dispatch({ type: "set_call_type", callType: "video" });
    }
    dispatch({ type: "set_caller", caller: true });
    dispatch({ type: "set_call", call });
    dispatch({ type: "set_call_state", callState: "state_creating" });
    try {
        room = await createRoom(roomName);
        console.log("created room: ", room);
        dispatch({ type: "set_call_room", callRoom: room });
    } catch (error) {
        room = null;
        console.log('Error creating room', error);
        await call.destroy();
        dispatch({ type: "set_call_room", callRoom: null });
        dispatch({ type: "set_call", call: null });
        dispatch({ type: "set_call_state", callState: "state_idle" });
        window.callDelete = null;
        //destroy the call object;
    };
    if (room) {
        dispatch({ type: "set_call_state", callState: "state_joining" });
        dispatch({ type: "set_call_queries", callQueries: { userQuery, receiverQuery } });
        try {
            await db.runTransaction(async transaction => {
                console.log("runing transaction");
                var userData = (await transaction.get(receiverQuery)).data();
                //console.log("user data: ", userData);
                if (!userData || !userData?.callerID || userData?.otherUserLeft) {
                    console.log("runing set");
                    transaction.set(receiverQuery, {
                        room,
                        callType: audio ? "audio" : "video",
                        isCaller: false,
                        otherUserLeft: false,
                        callerID: id,
                        otherID,
                        otherUserName: userName,
                        otherUserRatio: window.screen.width / window.screen.height,
                        photo: audio ? userPhoto : ""
                    });
                    transaction.set(userQuery, {
                        room,
                        callType: audio ? "audio" : "video",
                        isCaller: true,
                        otherUserLeft: false,
                        otherUserJoined: false,
                        callerID: id,
                        otherID
                    });
                } else {
                    console.log('transaction failed');
                    throw userData;
                }
            });
            if (sendNotif) {
                sendNotif();
                const notifTimeout = setInterval(() => {
                    sendNotif();
                }, 1500);
                dispatch({ type: "set_notif_tiemout", notifTimeout });
            }
            call.join({ url: room.url, videoSource: !audio });
        } catch (userData) {
            //delete the room we made
            deleteRoom(roomName);
            await call.destroy();
            if (userData.otherID === id) {
                console.log("you and the other user are calling each other at the same time");
                joinCall(dispatch, receiverQuery, userQuery, userData.room, userName, audio ? userPhoto : "", userData.callType);
            } else {
                console.log("other user already in a call");
                dispatch({ type: "set_call_room", callRoom: null });
                dispatch({ type: "set_call", call: null });
                dispatch({ type: "set_call_state", callState: "state_otherUser_calling" });
            }
        };
    };
};