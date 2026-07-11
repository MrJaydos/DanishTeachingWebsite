import { speakText, isTtsSupported } from "../tts.js";
import { useSettings } from "../context/SettingsContext.jsx";

// A small round button that speaks text aloud via SpeechSynthesis, in
// whichever language is being studied (defaults to Danish).
// Hidden entirely while muted (quiet mode), so there's no dead control.
export default function AudioButton({
  text,
  langCode = "da",
  title = "Listen",
  large = false,
}) {
  const { muted } = useSettings();
  if (!isTtsSupported() || muted) return null;
  return (
    <button
      type="button"
      className={`audio-btn${large ? " large" : ""}`}
      title={title}
      aria-label={title}
      onClick={(e) => {
        e.stopPropagation();
        speakText(text, langCode);
      }}
    >
      🔊
    </button>
  );
}
