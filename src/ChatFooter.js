import { memo, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Send, MicRounded, CancelRounded, CheckCircleRounded, AddPhotoAlternate } from '@mui/icons-material';
import db, { createTimestamp, fieldIncrement, audioStorage } from "./firebase";
import { useStateValue } from './StateProvider';
import { CSSTransition } from "react-transition-group";
import recorder from "./recorder.js";
import SpeedDial from '@mui/material/SpeedDial';
import SpeedDialAction from '@mui/material/SpeedDialAction';
import AttachFileIcon from '@mui/icons-material/AttachFile';
//import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import "./ChatFooter.css";

const wait = time => new Promise(resolve => setTimeout(resolve, time));

function preventDefault(e) {
	var code = e.keyCode || e.which;
	if (code == 13) {
		e.preventDefault();
		return false;
	}
};

function prevent(e) {
	console.log("preventing default");
	e.preventDefault();
}

const recordCompatible = Boolean(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);

console.log({ recordCompatible });

const speedDialStyle = {
	width: 46,
	position: "absolute",
	left: 0,
	bottom: 0,
	"& .css-7dv1rb-MuiButtonBase-root-MuiFab-root-MuiSpeedDial-fab": {
		width: "46px !important",
		height: "46px !important",
		boxShadow: "none !important",
		backgroundColor: "transparent !important",
		color: "#757575 !important",
	},
	"& .css-7dv1rb-MuiButtonBase-root-MuiFab-root-MuiSpeedDial-fab:hover": {
		backgroundColor: "transparent !important",
		color: "#757575 !important",
		boxShadow: "none !important",
	},
	"& .MuiSpeedDial-actions": {
		paddingBottom: "38px"
	},
}

export default memo(function ChatFooter({ input, handleFocus, change, sendMessage, setFocus, image, focus, state, token, roomID, setAudioID, handleFile, sendingMessage, handleMedia }) {
	const [recording, setRecording] = useState(false);
	const [recordingTimer, setRecordingTimer] = useState("00:00");
	const [open, setOpen] = useState(false);
	const [{ user }] = useStateValue();
	const attachFileRef = useRef();
	const attachMediaRef = useRef();
	const recordingEl = useRef();
	const inputRef = useRef();
	const timerInterval = useRef();
	const record = useRef();

	const handleBlur = useCallback(function (event) {
		if (!event.currentTarget.contains(event.relatedTarget) && !recording) {
			setFocus(false)
		} else {
			setFocus(true);
		}
	}, [recording])

	const sendAudio = useCallback(async function (audioFile, timer, audioName) {
		if (!sendingMessage.current) {
			sendingMessage.current = true;
			/*update recording status on the database */
			db.collection("rooms").doc(roomID).set({
				[user.uid]: false,
			}, { merge: true });
			db.collection("rooms").doc(roomID).set({
				lastMessage: {
					audio: true,
					message: "",
					time: timer,
				},
				seen: false
			}, { merge: true });
			if (state.userID) {
				db.collection("users").doc(state.userID).collection("chats").doc(roomID).set({
					timestamp: createTimestamp(),
					photoURL: user.photoURL ? user.photoURL : null,
					name: user.displayName,
					userID: user.uid,
					unreadMessages: fieldIncrement(1),
				}, { merge: true });
				db.collection("users").doc(user.uid).collection("chats").doc(roomID).set({
					timestamp: createTimestamp(),
					photoURL: state.photoURL ? state.photoURL : null,
					name: state.name,
					userID: state.userID
				}, { merge: true });
			} else {
				db.collection("users").doc(user.uid).collection("chats").doc(roomID).set({
					timestamp: createTimestamp(),
					photoURL: state.photoURL ? state.photoURL : null,
					name: state.name,
				});
			};
			const doc = await db.collection("rooms").doc(roomID).collection("messages").add({
				name: user.displayName,
				uid: user.uid,
				timestamp: createTimestamp(),
				time: new Date().toUTCString(),
				audioUrl: "uploading",
				transcript: "$state=loading",
				audioName,
				audioPlayed: false
			});
			await audioStorage.child(audioName).put(audioFile);
			db.collection("transcripts").add({
				audioName,
				roomID,
				messageID: doc.id,
				short: false, //timer[1] === "0",
				supportWebM: false//MediaRecorder.isTypeSupported("audio/webm")
			});
			const url = await audioStorage.child(audioName).getDownloadURL();
			db.collection("rooms").doc(roomID).collection("messages").doc(doc.id).update({
				audioUrl: url
			});
			if (state.userID && token !== "") {
				db.collection("notifications").add({
					userID: user.uid,
					title: user.displayName,
					body: "🎙️ " + timer,
					photoURL: user.photoURL,
					token: token
				});
			};
			sendingMessage.current = false;
		}
	}, [state, token]);

	const startRecording = useCallback(async function (e) {
		e.preventDefault();
		if (window.navigator.onLine) {
			if (focus) {
				//inputRef.current.focus();
			}
			await wait(150);
			record.current = await recorder(roomID);
			setAudioID(null);
			inputRef.current.style.width = "calc(100% - 56px)"
			await wait(305);
			setRecording(true);
		} else {
			alert("No access to internet !!!");
		}
	}, [focus])

	const stopRecording = useCallback(async function () {
		if (focus) {
			//inputRef.current.focus();
		}
		/*Update user recording status */
		db.collection("rooms").doc(roomID).set({
			[user.uid]: false,
		}, { merge: true });
		clearInterval(timerInterval.current);
		const stopped = record.current.stop();
		recordingEl.current.style.opacity = "0";
		await wait(300);
		setRecording(false);
		inputRef.current.style.width = "calc(100% - 112px)";
		const time = recordingTimer;
		setRecordingTimer("00:00");
		return [stopped, time];
	}, [recordingTimer, focus])

	const finishRecording = useCallback(async function () {
		var [audio, time] = await stopRecording();
		audio = await audio;
		console.log("recorded audio: ", audio);
		sendAudio(audio.audioFile, time, audio.audioName);
	}, [sendAudio, stopRecording])

	const pad = useCallback(function (val) {
		var valString = val + "";
		if (valString.length < 2) {
			return "0" + valString;
		} else {
			return valString;
		}
	}, []);

	const timer = useCallback(function () {
		const start = Date.now();
		timerInterval.current = setInterval(setTime, 100);

		function setTime() {
			const delta = Date.now() - start; // milliseconds elapsed since start
			const totalSeconds = Math.floor(delta / 1000);
			setRecordingTimer(pad(parseInt(totalSeconds / 60)) + ":" + pad(totalSeconds % 60))
		}
	}, []);

	useEffect(() => {
		const a = async () => {
			await wait(10);
			recordingEl.current.style.opacity = "1";
			await wait(100);
			timer();
			db.collection("rooms").doc(roomID).set({
				[user.uid]: "recording",
			}, { merge: true })
			record.current.start();
		}
		if (recording) {
			a();
		}
	}, [recording]);

	const btnIcons = useMemo(() => recordCompatible ? (<>
		<CSSTransition
			in={(input !== "" || (input === "" && image.length > 0))}
			timeout={{
				enter: 400,
				exit: 200,
			}}
			classNames="send__animate2"
		>
			<Send
				style={{
					width: 20,
					height: 20,
					color: "white"
				}}
			/>
		</CSSTransition>
		<CSSTransition
			in={!(input !== "" || (input === "" && image.length > 0))}
			timeout={{
				enter: 400,
				exit: 200,
			}}
			classNames="send__animate"
		>
			<MicRounded
				style={{
					width: 24,
					height: 24,
					color: "white"
				}}
			/>
		</CSSTransition>
	</>) : (
		<Send
			style={{
				width: 20,
				height: 20,
				color: "white",
				opacity: 1
			}}
		/>
	), [input, image]);

	const fileOpen = useCallback(() => {
		setOpen(false);
		attachFileRef.current.click();
	}, []);

	const mediaOpen = useCallback(() => {
		setOpen(false);
		attachMediaRef.current.click();
	}, []);

	const onOpen = useCallback(() => {
		setOpen(true);
	}, []);

	const onClose = useCallback(() => {
		setOpen(false);
	}, []);

	const blurInput = useCallback(() => {
		inputRef.current.blur()
	}, []);

	return (
		<div className="chat__footer" onBlur={handleBlur} >
			<form
				onKeyPress={input === "" ? preventDefault : null}
			>
				{/*<input ref={attachFileRef} id="attach-file" style={{ display: "none" }} type="file" onChange={handleFile} multiple />*/}
				<input ref={attachMediaRef} id="attach-media" style={{ display: "none" }} accept="image/*" type="file" onChange={handleMedia} multiple />
				<SpeedDial
					sx={speedDialStyle}
					icon={<AttachFileIcon />}
					ariaLabel="attach_media-speed_dial"
					transitionDuration={0}
					open={open}
					onOpen={onOpen}
					onClose={onClose}
				>
					<SpeedDialAction
						icon={<AddPhotoAlternate />}
						tooltipTitle="Add photos"
						onClick={!recording ? mediaOpen : null}
					/>
					{/*<SpeedDialAction
						icon={<InsertDriveFileIcon />}
						tooltipTitle="Add photos"
						onClick={fileOpen}
					/>*/}
				</SpeedDial>
				<input
					ref={inputRef}
					onClick={!recording ? handleFocus : blurInput}
					onChange={!recording ? change : null}
					onKeyPress={recording ? () => false : null}
					onFocus={() => setFocus(true)}
					placeholder="Type a message"
					className="chat__footer--input"
					value={input}
				/>
				<button
					type="submit"
					className="send__btn"
					onClick={input !== "" || (input === "" && image.length > 0) ? sendMessage : recordCompatible && sendMessage ? startRecording : prevent}
				>
					{btnIcons}
				</button>
			</form>
			{recording ?
				<div ref={recordingEl} className="record">
					<CancelRounded
						style={{
							width: 30,
							height: 30,
							color: "#F20519"
						}}
						onClick={stopRecording}
					/>
					<div>
						<div className="record__redcircle"></div>
						<div className="record__duration">{recordingTimer}</div>
					</div>
					<CheckCircleRounded
						style={{
							width: 30,
							height: 30,
							color: "#41BF49"
						}}
						onClick={finishRecording}
					/>
				</div> : null
			}
		</div>
	);
});