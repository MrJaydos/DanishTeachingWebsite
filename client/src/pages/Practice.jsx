import { useEffect, useRef, useState } from "react";
import { streamChatReply } from "../chat.js";
import { speakText } from "../tts.js";
import { playAchievement, playLevelUp } from "../sfx.js";
import { fireConfetti } from "../confetti.js";
import AudioButton from "../components/AudioButton.jsx";
import { api } from "../api.js";
import { useSettings } from "../context/SettingsContext.jsx";

// Each scenario's opening line and the input placeholder, per target
// language. Extend both alongside SUPPORTED_LANGUAGES in studyLanguage.js
// when adding a new target language.
const SCENARIOS = [
  {
    key: "small_talk",
    label: "Small talk",
    icon: "💬",
    openers: { da: "Hej! Hvordan går det?", ja: "こんにちは!調子はどうですか?" },
  },
  {
    key: "cafe_shopping",
    label: "Café & Shopping",
    icon: "☕",
    openers: { da: "Hej, velkommen! Hvad kan jeg hjælpe med?", ja: "いらっしゃいませ!何になさいますか?" },
  },
  {
    key: "everyday_phrases",
    label: "Everyday Phrases",
    icon: "🗺️",
    openers: { da: "Undskyld, kan du hjælpe mig lige et øjeblik?", ja: "すみません、ちょっと聞いてもいいですか?" },
  },
];

const INPUT_PLACEHOLDERS = { da: "Skriv på dansk…", ja: "日本語で書いてください…" };

const LEVELS = [
  { key: "beginner", label: "Beginner" },
  { key: "intermediate", label: "Intermediate" },
  { key: "advanced", label: "Advanced" },
];

const SCENARIO_KEY = "danish_practice_scenario";
const LEVEL_KEY = "danish_practice_level";

// Split "target-language text\nTip: english note" into its two parts. The
// Tip line is only present when the model found something worth correcting.
function splitReply(content) {
  const match = content.match(/\n?Tip:\s*(.+)$/s);
  if (!match) return { text: content.trim(), tip: null };
  return { text: content.slice(0, match.index).trim(), tip: match[1].trim() };
}

export default function Practice() {
  const { studyLanguage } = useSettings();
  const [scenario, setScenario] = useState(() => localStorage.getItem(SCENARIO_KEY) || "small_talk");
  const [level, setLevel] = useState(() => localStorage.getItem(LEVEL_KEY) || "beginner");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(null); // in-progress assistant text, or null
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const bottomRef = useRef(null);

  const [xpState, setXpState] = useState(null); // { xpTotal, level, xpIntoLevel, xpForNextLevel }
  const [xpFloat, setXpFloat] = useState(null);
  const [toasts, setToasts] = useState([]);
  const toastIdRef = useRef(0);

  useEffect(() => {
    api.dashboard().then((d) =>
      setXpState({ xpTotal: d.xpTotal, level: d.level, xpIntoLevel: d.xpIntoLevel, xpForNextLevel: d.xpForNextLevel })
    );
  }, []);

  function addToast(toast, ttl = 4000) {
    const id = ++toastIdRef.current;
    setToasts((t) => [...t, { id, ...toast }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), ttl);
  }

  function opener() {
    const s = SCENARIOS.find((s) => s.key === scenario) || SCENARIOS[0];
    return s.openers[studyLanguage] || s.openers.da;
  }

  function resetConversation() {
    setMessages([{ role: "assistant", content: opener() }]);
    setStreaming(null);
    setError(null);
  }

  // A new scenario — or switching which language is being studied — starts a
  // fresh conversation; old context wouldn't match the new setting anyway,
  // and a language switch especially shouldn't carry over a conversation
  // that was happening in a different language.
  useEffect(() => {
    resetConversation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenario, studyLanguage]);

  // Switching level, though, keeps the conversation going — the AI just
  // adapts its Danish going forward. Drop in a small marker so it's clear the
  // switch took effect. Skipped on mount (only real changes should note).
  const prevLevelRef = useRef(level);
  useEffect(() => {
    if (prevLevelRef.current === level) return;
    prevLevelRef.current = level;
    const label = LEVELS.find((l) => l.key === level)?.label || level;
    setMessages((prev) => [...prev, { role: "note", content: `Switched to ${label} level` }]);
  }, [level]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming]);

  function chooseScenario(key) {
    setScenario(key);
    localStorage.setItem(SCENARIO_KEY, key);
  }

  function chooseLevel(key) {
    setLevel(key);
    localStorage.setItem(LEVEL_KEY, key);
  }

  async function send() {
    const text = input.trim();
    if (!text || submitting) return;
    setInput("");
    setError(null);
    const history = [...messages, { role: "user", content: text }];
    setMessages(history);
    setSubmitting(true);
    setStreaming("");

    // "note" entries (e.g. "Switched to Advanced level") are UI-only markers
    // and aren't part of the actual conversation sent to the model.
    const apiHistory = history.filter((m) => m.role !== "note");
    const xpStateBefore = xpState;

    const language = studyLanguage;
    let full = "";
    await streamChatReply(
      { scenario, level, language, messages: apiHistory },
      {
        onText: (chunk) => {
          full += chunk;
          setStreaming(full);
        },
        onDone: (payload) => {
          setMessages((prev) => [...prev, { role: "assistant", content: full }]);
          setStreaming(null);
          setSubmitting(false);
          speakText(splitReply(full).text, language);

          const { xpEarned, level: newLevel, xpIntoLevel, xpForNextLevel, newAchievements } = payload;
          if (xpEarned > 0) {
            setXpFloat(xpEarned);
            setTimeout(() => setXpFloat(null), 1200);
          }
          if (xpStateBefore && newLevel > xpStateBefore.level) {
            addToast({ icon: "⭐", title: `Level ${newLevel}!`, subtitle: "You leveled up." });
            fireConfetti({ count: 70 });
            playLevelUp();
          }
          setXpState({ xpTotal: (xpStateBefore?.xpTotal || 0) + xpEarned, level: newLevel, xpIntoLevel, xpForNextLevel });

          if (newAchievements?.length) {
            newAchievements.forEach((a) =>
              addToast({ icon: a.icon, title: `Achievement: ${a.label}`, subtitle: a.description })
            );
            fireConfetti({ count: 60 });
            playAchievement();
          }
        },
        onError: (msg) => {
          setError(msg);
          setStreaming(null);
          setSubmitting(false);
        },
      }
    );
  }

  function onKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  const celebrationStack = toasts.length > 0 && (
    <div className="celebration-stack">
      {toasts.map((t) => (
        <div className="celebration-toast" key={t.id}>
          <span className="celebration-icon">{t.icon}</span>
          <div>
            <div className="celebration-title">{t.title}</div>
            <div className="celebration-subtitle">{t.subtitle}</div>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="practice-wrap">
      {celebrationStack}
      <div className="spread">
        <div>
          <p className="section-title">Conversation practice</p>
          <h1>Practice</h1>
        </div>
        <button className="btn" onClick={resetConversation}>
          New conversation
        </button>
      </div>

      <div className="practice-controls">
        <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
          {SCENARIOS.map((s) => (
            <button
              key={s.key}
              className={`chip ${scenario === s.key ? "active" : ""}`}
              onClick={() => chooseScenario(s.key)}
            >
              {s.icon} {s.label}
            </button>
          ))}
        </div>
        <div className="row" style={{ flexWrap: "wrap", gap: 8, marginTop: 8 }}>
          {LEVELS.map((l) => (
            <button
              key={l.key}
              className={`chip level ${level === l.key ? "active" : ""}`}
              onClick={() => chooseLevel(l.key)}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="alert error">{error}</div>}

      <div className="chat-window">
        {messages.map((m, i) => {
          if (m.role === "note") {
            return (
              <div key={i} className="chat-note">
                {m.content}
              </div>
            );
          }
          const { text, tip } = m.role === "assistant" ? splitReply(m.content) : { text: m.content, tip: null };
          return (
            <div key={i} className={`chat-bubble ${m.role}`}>
              <div className="row" style={{ gap: 8 }}>
                <span className="chat-text">{text}</span>
                {m.role === "assistant" && <AudioButton text={text} langCode={studyLanguage} />}
              </div>
              {tip && <div className="chat-tip">💡 {tip}</div>}
            </div>
          );
        })}
        {streaming !== null && (
          <div className="chat-bubble assistant">
            <span className="chat-text">
              {splitReply(streaming).text}
              <span className="chat-cursor">▍</span>
            </span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {xpFloat && <div className="xp-float">+{xpFloat} XP</div>}

      <div className="chat-input-row">
        <input
          className="input"
          placeholder={INPUT_PLACEHOLDERS[studyLanguage] || INPUT_PLACEHOLDERS.da}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={submitting}
        />
        <button className="btn primary" onClick={send} disabled={submitting || !input.trim()}>
          Send
        </button>
      </div>
    </div>
  );
}
