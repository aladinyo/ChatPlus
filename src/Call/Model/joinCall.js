import DailyIframe from '@daily-co/daily-js';

export default function joinCall(dispatch, receiverQuery, userQuery, room, otherUserName, photo, callType) {
    const call = new DailyIframe.createCallObject();
    call.join({ url: room.url, videoSource: callType === "video" });
    receiverQuery.set({
        otherUserRatio: window.screen.width / window.screen.height
    }, { merge: true });
    photo ? dispatch({ type: "set_other_user_photo", photo}) : dispatch({ type: "set_other_user_photo", photo: null});
    dispatch({ type: "set_call_type", callType });
    dispatch({type: "set_caller", caller: false});
    dispatch({ type: "set_call", call });
    dispatch({ type: "set_call_state", callState: "state_joining" });
    dispatch({ type: "set_call_room", callRoom: room });
    dispatch({ type: "set_call_queries", callQueries: { userQuery, receiverQuery } });
    dispatch({ type: "set_other_user_name", otherUserName });
};