// Danish text-to-speech using the browser's SpeechSynthesis API.
// No audio files are stored — the phrase is spoken on demand in a Danish voice
// if one is available on the user's device.

let cachedVoice;

function pickDanishVoice() {
  if (cachedVoice !== undefined) return cachedVoice;
  const voices = window.speechSynthesis?.getVoices() || [];
  cachedVoice =
    voices.find((v) => v.lang === "da-DK") ||
    voices.find((v) => v.lang?.toLowerCase().startsWith("da")) ||
    null;
  return cachedVoice;
}

// Voices can load asynchronously; refresh the cache when they arrive.
if (typeof window !== "undefined" && window.speechSynthesis) {
  window.speechSynthesis.onvoiceschanged = () => {
    cachedVoice = undefined;
    pickDanishVoice();
  };
}

export function isTtsSupported() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

// Global mute for quiet learning sessions. When muted, speakDanish is a no-op
// and any in-flight speech is cancelled.
let muted = false;
export function setMuted(value) {
  muted = !!value;
  if (muted && isTtsSupported()) window.speechSynthesis.cancel();
}
export function isMuted() {
  return muted;
}

export function speakDanish(text) {
  if (muted || !isTtsSupported() || !text) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "da-DK";
  const voice = pickDanishVoice();
  if (voice) utter.voice = voice;
  utter.rate = 0.95;
  window.speechSynthesis.speak(utter);
}
