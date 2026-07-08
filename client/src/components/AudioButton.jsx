import { speakDanish, isTtsSupported } from "../tts.js";
import { useSettings } from "../context/SettingsContext.jsx";

// A small round button that speaks Danish text aloud via SpeechSynthesis.
// Hidden entirely while muted (quiet mode), so there's no dead control.
export default function AudioButton({ text, title = "Listen (Danish)", large = false }) {
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
        speakDanish(text);
      }}
    >
      🔊
    </button>
  );
}
