import { v4 as uuidv4 } from 'uuid';
import MicRecorder from "mic-recorder-to-mp3"
//handle media permission request
export default function record() {
  return new Promise(resolve => {
    navigator.mediaDevices.getUserMedia({ audio: true }).then(() => {
      const mediaRecorder = new MicRecorder({
        bitRate: 128
      })

      const start = async () => {
        try {
          console.log("started to record")
          await mediaRecorder.start();
          console.log("recording");
        } catch (e) {
          console.log("error starting to record:", e);
        }
      };

      const stop = () => {
        return new Promise(resolve => {
          mediaRecorder.stop().getMp3().then(([buffer, blob]) => {
            console.log("blob: ", blob);
            console.log("buffer: ", buffer.sampleRate);
            console.log("type: ", blob.type);
            const audioName = uuidv4() + ".mp3";
            const audioFile = new File(buffer, audioName, { type: "audio/mpeg", lastModified: Date.now() });
            console.log("audio file: ", audioFile);
            const audioUrl = URL.createObjectURL(audioFile);
            const audio = new Audio(audioUrl);
            const play = () => {
              audio.play();
            }
            resolve({ audioFile, audioUrl, play, audioName });
          });
        });
      };
      resolve({ start, stop });
    });
  });
};