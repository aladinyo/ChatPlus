// Imports the Google Cloud client library
const speech = require('@google-cloud/speech').v1p1beta1;
const { gcsUriLink } = require("./configKeys")

// Creates a client
const client = new speech.SpeechClient({ keyFilename: "./audio_transcript.json" });

async function textToAudio(audioName, isShort) {
    // The path to the remote LINEAR16 file
    const gcsUri = gcsUriLink + "/audios/" + audioName;

    // The audio file's encoding, sample rate in hertz, and BCP-47 language code
    const audio = {
        uri: gcsUri,
    };
    const config = {
        encoding: "MP3",
        sampleRateHertz: 48000,
        languageCode: 'en-US',
        alternativeLanguageCodes: ['es-ES', 'fr-FR']
    };
    console.log("audio config: ", config);
    const request = {
        audio: audio,
        config: config,
    };

    // Detects speech in the audio file
    if (isShort) {
        const [response] = await client.recognize(request);
        return response.results.map(result => result.alternatives[0].transcript).join('\n');
    }
    const [operation] = await client.longRunningRecognize(request);
    const [response] = await operation.promise().catch(e => console.log("response promise error: ", e));
    return response.results.map(result => result.alternatives[0].transcript).join('\n');
};

module.exports = textToAudio;