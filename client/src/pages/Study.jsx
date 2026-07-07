import { useEffect, useState, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { speakDanish } from "../tts.js";
import AudioButton from "../components/AudioButton.jsx";
import { gradeAnswer, makeHint, suggestedRating } from "../answerCheck.js";

// Ratings are a self-assessment of how well you recalled the answer. The
// wording is deliberately plain (no Anki jargon) and each explains its effect.
const RATINGS = [
  { key: "again", label: "Forgot", effect: "See it again soon", cls: "again" },
  { key: "hard", label: "Hard", effect: "Shorter gap", cls: "hard" },
  { key: "good", label: "Good", effect: "Normal gap", cls: "good" },
  { key: "easy", label: "Easy", effect: "Longer gap", cls: "easy" },
];

const TYPE_MODE_KEY = "danish_type_mode";

export default function Study() {
  const [queue, setQueue] = useState(null);
  const [current, setCurrent] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [done, setDone] = useState(0);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [typeMode, setTypeMode] = useState(
    () => localStorage.getItem(TYPE_MODE_KEY) === "1"
  );
  const [typed, setTyped] = useState("");
  const [result, setResult] = useState(null); // "correct" | "close" | "wrong" | null
  const [showHint, setShowHint] = useState(false);
  const inputRef = useRef(null);

  const isNew = current?.status === "new";

  const loadSession = useCallback(async () => {
    setQueue(null);
    setError(null);
    try {
      const { cards } = await api.session({ limit: 30, new: 15 });
      setQueue(cards);
      setCurrent(cards[0] || null);
      setDone(0);
    } catch (e) {
      setError(e.message);
      setQueue([]);
    }
  }, []);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  // Initialise per-card state whenever the current card changes. New cards are
  // shown already "revealed" — we introduce the word instead of asking the user
  // to guess something they've never seen.
  useEffect(() => {
    if (!current) return;
    const fresh = current.status === "new";
    setRevealed(fresh);
    setTyped("");
    setResult(null);
    setShowHint(false);
    speakDanish(current.danishText); // no-op when muted
    if (typeMode && !fresh) setTimeout(() => inputRef.current?.focus(), 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  function toggleTypeMode() {
    setTypeMode((v) => {
      const next = !v;
      localStorage.setItem(TYPE_MODE_KEY, next ? "1" : "0");
      return next;
    });
  }

  function checkTyped() {
    if (!typed.trim()) return;
    setResult(gradeAnswer(typed, current.englishText));
    setRevealed(true);
  }

  async function rate(rating) {
    if (!current || submitting) return;
    setSubmitting(true);
    try {
      await api.review(current.id, rating);
    } catch (e) {
      setError(e.message);
      setSubmitting(false);
      return;
    }
    setQueue((prev) => {
      const rest = prev.slice(1);
      // A re-queued card is no longer "new" — next time it's a recall test.
      const next =
        rating === "again" ? [...rest, { ...current, status: "review" }] : rest;
      setCurrent(next[0] || null);
      return next;
    });
    setDone((d) => d + 1);
    setSubmitting(false);
  }

  // Keyboard shortcuts. Ignore them while typing in the answer field, except
  // Enter (which checks the answer).
  useEffect(() => {
    function onKey(e) {
      if (!current) return;
      const inField = document.activeElement === inputRef.current;
      if (inField) {
        if (e.key === "Enter" && !revealed) checkTyped();
        return;
      }
      if (e.code === "Space" && !revealed) {
        e.preventDefault();
        setRevealed(true);
      } else if (revealed && ["1", "2", "3", "4"].includes(e.key)) {
        rate(RATINGS[Number(e.key) - 1].key);
      } else if (e.key.toLowerCase() === "h" && !revealed) {
        setShowHint(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (queue === null) return <div className="spinner" />;
  if (error && !current) return <div className="alert error">{error}</div>;

  if (!current) {
    return (
      <div className="study-wrap">
        <div className="center-msg">
          <div className="big">🎉</div>
          <h1>Session complete!</h1>
          <p className="muted">
            You reviewed {done} card{done === 1 ? "" : "s"}. Nicely done.
          </p>
          <div className="cta-row" style={{ justifyContent: "center", marginTop: 20 }}>
            <button className="btn" onClick={loadSession}>
              Study more
            </button>
            <Link className="btn primary" to="/">
              Back to dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const total = done + queue.length;
  const pct = total > 0 ? (done / total) * 100 : 0;
  const suggested = suggestedRating(result);

  return (
    <div className="study-wrap">
      <div className="study-progress">
        <div className="fill" style={{ width: `${pct}%` }} />
      </div>

      <div className="spread" style={{ marginBottom: 16 }}>
        <span className="muted" style={{ fontSize: "0.85rem" }}>
          {queue.length} left · {isNew ? "🆕 new" : "🔁 review"}
        </span>
        <button
          className={`type-toggle ${typeMode ? "on" : ""}`}
          onClick={toggleTypeMode}
          title="Toggle typing your answer"
        >
          ✍️ Type answer {typeMode ? "on" : "off"}
        </button>
      </div>

      <div className={`card flashcard ${isNew ? "is-new" : ""}`}>
        <span className="pill">{current.deckName}</span>

        {isNew && (
          <div className="intro-note">
            🆕 New word — here's what it means. No need to guess.
          </div>
        )}

        <div className="row">
          <span className="danish">{current.danishText}</span>
          <AudioButton text={current.danishText} />
        </div>

        {!revealed && (
          <div className="prompt-note muted">What does this mean in English?</div>
        )}

        {showHint && !revealed && (
          <div className="hint">
            <span className="hint-label">Hint</span>
            <span className="hint-text">{makeHint(current.englishText)}</span>
          </div>
        )}

        {revealed ? (
          <>
            <div className="divider" />
            <div className="english">{current.englishText}</div>
            {current.exampleSentence && (
              <div className="example">{current.exampleSentence}</div>
            )}
            {result && (
              <div className={`feedback ${result}`}>
                {result === "correct" && <>✓ Correct — you typed “{typed}”</>}
                {result === "close" && (
                  <>≈ Almost — you typed “{typed}”. Close enough?</>
                )}
                {result === "wrong" && <>✗ Not quite — you typed “{typed}”</>}
              </div>
            )}
          </>
        ) : typeMode ? (
          <div className="type-area">
            <input
              ref={inputRef}
              className="input"
              placeholder="Type the English meaning…"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck="false"
            />
            <div className="row" style={{ justifyContent: "center", marginTop: 12 }}>
              <button className="btn" onClick={() => setShowHint(true)} disabled={showHint}>
                Hint
              </button>
              <button className="btn primary" onClick={checkTyped} disabled={!typed.trim()}>
                Check <span className="muted">(enter)</span>
              </button>
              <button className="btn" onClick={() => setRevealed(true)}>
                Skip
              </button>
            </div>
          </div>
        ) : (
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn" onClick={() => setShowHint(true)} disabled={showHint}>
              Hint <span className="muted">(h)</span>
            </button>
            <button className="btn primary" onClick={() => setRevealed(true)}>
              Show answer <span className="muted">(space)</span>
            </button>
          </div>
        )}
      </div>

      {revealed && (
        <div className="rate-block">
          <p className="rate-heading">
            {isNew ? "How familiar is this word already?" : "How well did you know it?"}
          </p>
          <div className="rate-grid">
            {RATINGS.map((r, i) => (
              <button
                key={r.key}
                className={`rate-btn ${r.cls} ${suggested === r.key ? "suggested" : ""}`}
                disabled={submitting}
                onClick={() => rate(r.key)}
              >
                <span className="rate-label">{r.label}</span>
                <small>{r.effect}</small>
                <span className="rate-key">{i + 1}</span>
              </button>
            ))}
          </div>
          <p className="muted rate-help">
            {isNew
              ? "Your rating sets when you'll first review this word."
              : "Rate yourself honestly — it sets when you'll see this card again."}
          </p>
        </div>
      )}
    </div>
  );
}
