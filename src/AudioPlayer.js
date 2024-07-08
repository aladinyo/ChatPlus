import { useState, useEffect, useLayoutEffect, memo, useRef, useCallback, useMemo } from 'react';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import PauseRoundedIcon from '@mui/icons-material/PauseRounded';
import CircularProgress from '@mui/material/CircularProgress';
import PlayForWorkRoundedIcon from '@mui/icons-material/PlayForWorkRounded';
import ErrorIcon from '@mui/icons-material/Error';
import Slider from '@mui/material/Slider';
import db from "./firebase";
import "./AudioPlayer.css";

function detectBrowser() {
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
console.log({ isSafari })
//console.log(navigator.userAgent.indexOf("AppleWebKit"));

function calculateMediaDuration(media) {
	return new Promise((resolve) => {
		media.addEventListener("loadedmetadata", function () {
			// set the mediaElement.currentTime  to a high value beyond its real duration
			console.log("loadedmetadata running");
			media.currentTime = Number.MAX_SAFE_INTEGER;
			// listen to time position change
			media.ontimeupdate = function () {
				media.ontimeupdate = function () { };
				console.log("running ontimeupdate")
				// setting player currentTime back to 0 can be buggy too, set it first to .1 sec
				media.currentTime = 0.1;
				media.currentTime = 0;
				// media.duration should now have its correct value, return it...
				console.log("media duration: ", media.duration);
				resolve(media.duration);
			}
		})
	});
};

function playthrough(setMediaLoaded, totalDuration, audio, setDuration, audioList, id) {
	console.log("running playthrough")
	if (totalDuration.current === "") {
		setMediaLoaded(true);
		let durationMinutes = Math.floor(audio.current.duration / 60);
		let durationSeconds = Math.floor(audio.current.duration - durationMinutes * 60);
		// Add a zero to the single digit time values 
		if (durationSeconds < 10) { durationSeconds = "0" + durationSeconds; }
		if (durationMinutes < 10) { durationMinutes = "0" + durationMinutes; }
		// Display the updated duration 
		totalDuration.current = durationMinutes + ":" + durationSeconds;
		setDuration(totalDuration.current);
		audioList.current[id].duration = totalDuration.current;
	}
};

function getCurrentTime(audio) {
	// Calculate the time left and the total duration 
	let currentMinutes = Math.floor(audio.currentTime / 60);
	let currentSeconds = Math.floor(audio.currentTime - currentMinutes * 60);

	// Add a zero to the single digit time values 
	if (currentSeconds < 10) { currentSeconds = "0" + currentSeconds; }
	if (currentMinutes < 10) { currentMinutes = "0" + currentMinutes; }

	// Display the updated duration 
	return currentMinutes + ":" + currentSeconds;
}

function initiateAudio(audioList, audioUrl, audioID) {
	//console.log("initiating audio")
	if (audioList.current[audioID]) {
		return audioList.current[audioID].audio;
	};
	//console.log("setting new audio")
	audioList.current[audioID] = {
		audio: isSafari ? new Audio() : new Audio(audioUrl)
	};
	//console.log("audio src", audioList.current[audioID].audio.src)
	return audioList.current[audioID].audio;
};

export default memo(function AudioPlayer({ audioList, sender, roomID, audioUrl, id, setAudioID, audioID, animState, audioPlayed }) {
	const [isPlaying, setIsPlaying] = useState(false);
	const [mediaLoaded, setMediaLoaded] = useState(false);
	const [loaded, setLoaded] = useState(false);
	const [metadataLoaded, setMetadataLoaded] = useState(false);
	const [error, setError] = useState(isSafari && !audioList.current[id]?.duration && audioUrl !== "uploading");
	const [sliderValue, setSliderValue] = useState(0);
	const [duration, setDuration] = useState("");
	const totalDuration = useRef("");
	const audio = useRef(null);
	const interval = useRef();
	const loadInterval = useRef([]);
	const uploading = useRef(audioUrl === "uploading");

	const play = useCallback(function () {
		audio.current.play();
		if (!audioPlayed && !sender) {
			db.collection("rooms").doc(roomID).collection("messages").doc(id).set({
				audioPlayed: true
			}, { merge: true });
		}
		if (audioID !== id) {
			setAudioID(id);
		}
		interval.current = setInterval(seekUpdate, 60);
		setIsPlaying(true);
	}, [audioPlayed, sender]);

	const pause = useCallback(function () {
		audio.current && audio.current.pause();
		clearInterval(interval.current);
		setIsPlaying(false);
		setDuration(totalDuration.current);
	}, []);

	const inputChange = useMemo(function () {
		if (mediaLoaded) {
			return function (e) {
				const seekto = audio.current.duration * (e.target.value / 100);
				audio.current.currentTime = seekto;
				setSliderValue(e.target.value);
			};
		};
		return null;
	}, [mediaLoaded]);

	const seekUpdate = useCallback(function () {
		let seekPosition = 0;
		// Check if the current track duration is a legible number 
		if (!isNaN(audio.current.duration)) {
			seekPosition = audio.current.currentTime * (100 / audio.current.duration);
			setSliderValue(seekPosition);
			setDuration(getCurrentTime(audio.current));
		};
	}, []);

	useLayoutEffect(() => {
		if (audioUrl !== "uploading") {
			audio.current = initiateAudio(audioList, audioUrl, id);
			if (isSafari && !audioList.current[id]?.duration) {
				setError(true)
			}
			!isSafari && audio.current.load();
			if (audioList.current[id]) {
				seekUpdate();
			};
		};
	}, [audioUrl]);

	useEffect(() => {
		return () => {
			loadInterval.current.forEach(element => {
				clearInterval(element);
			});
		}
	}, []);

	useEffect(() => {
		if (uploading.current === true && audioUrl !== "uploading") {
			if (!isSafari) {
				audio.current = new Audio(audioUrl);
				audio.current.load();
				//console.log("audio: ", audio);
			}
			setLoaded(true);
		} else if (uploading.current === false) {
			setLoaded(true);
		}
	}, [audioUrl]);

	const loadMetadata = useCallback((clicked) => {
		if (loaded || clicked) {
			console.log("loaded: ", loaded)
			console.log("clicked:; ", clicked);
			console.log("audio duration: ", audioList.current[id].duration);
			//console.log("audio is: ", audio.current);
			if (audioList.current[id]) {
				if (!audioList.current[id].duration) {
					if (isSafari) {
						console.log("safari audio load");
						audio.current.src = audioUrl;
						audio.current.load();
						audio.current.src = new String(audioUrl);
						audio.current.load();
					}
					calculateMediaDuration(audio.current).then(() => {
						setMetadataLoaded(true);
					});
				} else {
					setMetadataLoaded(true);
				};
			};
			audio.current.addEventListener("error", e => {
				setError(true);
				setLoaded(false);
				setMediaLoaded(false);
				console.log("audio error: ", e);
			});
		};
	}, [loaded, audioUrl]);

	const loadAudioAgain = useCallback(function () {
		//audio.current.load();
		loadMetadata(true)
		setLoaded(true);
		setError(false);
	}, [loadMetadata]);

	useEffect(() => {
		if (!isSafari || audioList.current[id]?.duration) {
			loadMetadata()
		}
	}, [loadMetadata]);

	useEffect(() => {
		console.log("metadataloaded: ", metadataLoaded);
		if (metadataLoaded) {
			const audioDuration = audioList.current[id].duration;
			console.log("audio duration: ", audioDuration);
			if (audioDuration) {
				totalDuration.current = audioDuration;
				setMediaLoaded(true);
				setDuration(audioDuration);
			} else {
				//audio.current.load();
				console.log("setting canplaythrough event");
				const runPlayThrough = () => playthrough(setMediaLoaded, totalDuration, audio, setDuration, audioList, id);
				if (isSafari) {
					audio.current.addEventListener("canplaythrough", () => console.log("you can play audio"));
					audio.current.addEventListener("canplay", () => console.log("you can play audio 2"));
					const interval = setInterval(() => {
						console.log("readyState: ", audio.current.readyState);
						//console.log("error audio: ", audio.current.error);
						if (audio.current.readyState === 4 || audio.current.readyState === 3) {
							runPlayThrough();
							clearInterval(interval);
						}
					}, 50);
					loadInterval.current.push(interval);
				} else {
					audio.current.addEventListener("canplaythrough", runPlayThrough);
				}
			};
			audio.current.addEventListener("ended", () => {
				clearInterval(interval.current);
				setDuration(totalDuration.current);
				setSliderValue(0);
				setIsPlaying(false);
			});
		};
	}, [metadataLoaded]);

	useEffect(() => {
		if (animState === "exiting") {
			audio.current && audio.current.pause();
		}
	}, [animState]);

	useEffect(() => {
		if (audioID !== id) {
			audio.current && audio.current.pause();
			setIsPlaying(false);
		}
	}, [audioID]);

	const btnColorClass = useMemo(() => {
		if (sender) {
			return "btn__audio--sender"
		}
		return ""
	}, [sender]);

	const btnColor = useMemo(() => {
		if (sender) {
			return "white"
		}
		return "#53ccfc"
	}, [sender]);

	return (
		<>
			<div className={`audioplayer ${audioUrl === "error" ? "audio__error" : ""}`}>
				{audioUrl === "error" ?
					<ErrorIcon />
					: !mediaLoaded && !error ?
						<CircularProgress className={btnColorClass} size={26} />
						: isPlaying && !error ?
							<PauseRoundedIcon sx={{ color: btnColor }} className={"pause " + btnColorClass} onClick={pause} />
							: !isPlaying && !error ?
								<PlayArrowRoundedIcon className={btnColorClass} onClick={play} />
								: error ?
									<button onClick={loadAudioAgain}>
										<PlayForWorkRoundedIcon className={btnColorClass} />
									</button>
									: null}
				<div>
					<Slider
						value={sliderValue}
						onChange={inputChange}
						sx={{
							color: audioPlayed ? btnColor : "#00FF00"
						}}
					/>
				</div>
			</div>
			<span className="chat__timestamp audioplayer__time">{duration}</span>
		</>
	)
})