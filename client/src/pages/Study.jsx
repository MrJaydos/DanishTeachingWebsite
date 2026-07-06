import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { speakDanish } from "../tts.js";
import AudioButton from "../components/AudioButton.jsx";

const RATINGS = [
  { key: "again", label: "Again", hint: "< 1 min", cls: "again" },
  { key: "hard", label: "Hard", hint: "tough", cls: "hard" },
  { key: "good", label: "Good", hint: "got it", cls: "good" },
  { key: "easy", label: "Easy", hint: "too easy", cls: "easy" },
];

export default function Study() {
  const [queue, setQueue] = useState(null); // array of cards, or null while loading
  const [current, setCurrent] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [done, setDone] = useState(0);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const loadSession = useCallback(async () => {
    setQueue(null);
    setError(null);
    try {
      const { cards } = await api.session({ limit: 30, new: 15 });
      setQueue(cards);
      setCurrent(cards[0] || null);
      setRevealed(false);
      setDone(0);
    } catch (e) {
      setError(e.message);
      setQueue([]);
    }
  }, []);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  // Speak the Danish automatically when a new card appears (nice for listening).
  useEffect(() => {
    if (current) speakDanish(current.danishText);
  }, [current]);

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

    // Advance the queue. "Again" re-queues the card near the end of the session.
    setQueue((prev) => {
      const rest = prev.slice(1);
      const next = rating === "again" ? [...rest, current] : rest;
      setCurrent(next[0] || null);
      return next;
    });
    setDone((d) => d + 1);
    setRevealed(false);
    setSubmitting(false);
  }

  // Keyboard shortcuts: space to flip, 1-4 to rate.
  useEffect(() => {
    function onKey(e) {
      if (!current) return;
      if (e.code === "Space") {
        e.preventDefault();
        if (!revealed) setRevealed(true);
      } else if (revealed && ["1", "2", "3", "4"].includes(e.key)) {
        rate(RATINGS[Number(e.key) - 1].key);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (queue === null) return <div className="spinner" />;

  if (error && !current) {
    return <div className="alert error">{error}</div>;
  }

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

  return (
    <div className="study-wrap">
      <div className="study-progress">
        <div className="fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="spread" style={{ marginBottom: 16 }}>
        <span className="muted" style={{ fontSize: "0.85rem" }}>
          {queue.length} left in session
        </span>
        <span className="muted" style={{ fontSize: "0.85rem" }}>
          {current.status === "new" ? "🆕 New card" : "🔁 Review"}
        </span>
      </div>

      <div className="card flashcard">
        <span className="pill">{current.deckName}</span>
        <div className="row">
          <span className="danish">{current.danishText}</span>
          <AudioButton text={current.danishText} />
        </div>

        {revealed ? (
          <>
            <div className="divider" />
            <div className="english">{current.englishText}</div>
            {current.exampleSentence && (
              <div className="example">{current.exampleSentence}</div>
            )}
          </>
        ) : (
          <button className="btn" onClick={() => setRevealed(true)} style={{ marginTop: 8 }}>
            Show answer <span className="muted">(space)</span>
          </button>
        )}
      </div>

      {revealed && (
        <div className="rate-grid">
          {RATINGS.map((r, i) => (
            <button
              key={r.key}
              className={`rate-btn ${r.cls}`}
              disabled={submitting}
              onClick={() => rate(r.key)}
            >
              {r.label}
              <small>{i + 1} · {r.hint}</small>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
