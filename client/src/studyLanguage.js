// The language currently being studied, plus the catalogue of languages the
// app can teach. Read/written via SettingsContext (see
// context/SettingsContext.jsx) so switching is reactive across Study,
// Browse, and Practice — a per-device preference, not account state.
//
// Adding a new target language touches four places: this list, the seed
// content in server/prisma/seedData.js, the TTS voice tag in
// client/src/tts.js's LANG_TAGS, and the chat prompt's language name in
// server/src/utils/chatPrompt.js's LANGUAGES.
export const SUPPORTED_LANGUAGES = [
  { code: "da", label: "Danish", flag: "🇩🇰" },
  { code: "ja", label: "Japanese", flag: "🇯🇵" },
];

// English is the native/translation side for every target language, so it
// isn't part of SUPPORTED_LANGUAGES (that list is target languages only) —
// but anywhere the UI shows a flag for the native side, use this one.
export const NATIVE_FLAG = "🇦🇺";

export function flagFor(code) {
  return SUPPORTED_LANGUAGES.find((l) => l.code === code)?.flag || NATIVE_FLAG;
}

export function labelFor(code) {
  return SUPPORTED_LANGUAGES.find((l) => l.code === code)?.label || "the target language";
}

const STUDY_LANGUAGE_KEY = "study_language";

export function getStudyLanguage() {
  return localStorage.getItem(STUDY_LANGUAGE_KEY) || "da";
}

export function persistStudyLanguage(code) {
  localStorage.setItem(STUDY_LANGUAGE_KEY, code);
}
