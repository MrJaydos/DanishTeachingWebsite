import { speakDanish, isTtsSupported } from "../tts.js";

// A small round button that speaks Danish text aloud via SpeechSynthesis.
export default function AudioButton({ text, title = "Listen (Danish)" }) {
  if (!isTtsSupported()) return null;
  return (
    <button
      type="button"
      className="audio-btn"
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
