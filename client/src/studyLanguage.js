// The language currently being studied. Shared across Study, Browse, and
// Practice (unlike per-page prefs such as Study's TYPE_MODE_KEY, this one
// needs to be read/written from more than one page) via localStorage since
// it's a per-device preference, not account state.
const STUDY_LANGUAGE_KEY = "study_language";

export function getStudyLanguage() {
  return localStorage.getItem(STUDY_LANGUAGE_KEY) || "da";
}

export function setStudyLanguage(code) {
  localStorage.setItem(STUDY_LANGUAGE_KEY, code);
}
