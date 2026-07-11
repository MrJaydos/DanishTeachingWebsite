// Text-to-speech using the browser's SpeechSynthesis API, for whichever
// language is currently being studied. No audio files are stored — the
// phrase is spoken on demand in a matching voice if one is available on the
// user's device.

// Maps a deck's ISO-ish language code to the BCP-47 tag SpeechSynthesis
// expects. Extend this when adding a new target language.
const LANG_TAGS = {
  da: "da-DK",
};

const voiceCache = new Map();

function pickVoice(langTag) {
  if (voiceCache.has(langTag)) return voiceCache.get(langTag);
  const voices = window.speechSynthesis?.getVoices() || [];
  const prefix = langTag.split("-")[0].toLowerCase();
  const voice =
    voices.find((v) => v.lang === langTag) ||
    voices.find((v) => v.lang?.toLowerCase().startsWith(prefix)) ||
    null;
  voiceCache.set(langTag, voice);
  return voice;
}

// Voices can load asynchronously; refresh the cache when they arrive.
if (typeof window !== "undefined" && window.speechSynthesis) {
  window.speechSynthesis.onvoiceschanged = () => {
    voiceCache.clear();
  };
}

export function isTtsSupported() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

// Global mute for quiet learning sessions. When muted, speakText is a no-op
// and any in-flight speech is cancelled.
let muted = false;
export function setMuted(value) {
  muted = !!value;
  if (muted && isTtsSupported()) window.speechSynthesis.cancel();
}
export function isMuted() {
  return muted;
}

export function speakText(text, langCode = "da") {
  if (muted || !isTtsSupported() || !text) return;
  const langTag = LANG_TAGS[langCode] || LANG_TAGS.da;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = langTag;
  const voice = pickVoice(langTag);
  if (voice) utter.voice = voice;
  utter.rate = 0.95;
  window.speechSynthesis.speak(utter);
}
