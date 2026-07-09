import { useEffect, useState, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { speakDanish } from "../tts.js";
import { playCorrect, playAgain, playAchievement, playLevelUp } from "../sfx.js";
import { fireConfetti } from "../confetti.js";
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
const DIRECTION_KEY = "danish_direction"; // "da-en" | "en-da"

export default function Study() {
  const [queue, setQueue] = useState(null);
  const [current, setCurrent] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [done, setDone] = useState(0);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [lastAction, setLastAction] = useState(null); // { card, previous, xpEarned, xpStateBefore, ratingLabel }

  const [combo, setCombo] = useState(0);
  const [xpState, setXpState] = useState(null); // { xpTotal, level, xpIntoLevel, xpForNextLevel }
  const [xpFloat, setXpFloat] = useState(null); // transient "+N XP" near the rate buttons
  const [toasts, setToasts] = useState([]); // achievement/level-up banners
  const toastIdRef = useRef(0);
  const sessionCelebratedRef = useRef(false);

  const [typeMode, setTypeMode] = useState(
    () => localStorage.getItem(TYPE_MODE_KEY) === "1"
  );
  const [direction, setDirection] = useState(
    () => localStorage.getItem(DIRECTION_KEY) || "da-en"
  );
  const [typed, setTyped] = useState("");
  const [result, setResult] = useState(null); // "correct" | "close" | "wrong" | null
  const [showHint, setShowHint] = useState(false);
  const inputRef = useRef(null);

  const isNew = current?.status === "new";
  const isListening = current?.cardType === "listening";
  // Listening cards are always audio -> meaning; the direction toggle only
  // applies to vocab/grammar cards.
  const reversed = !isListening && direction === "en-da";

  const frontText = current && !isListening ? (reversed ? current.englishText : current.danishText) : null;
  const backText = current && !isListening ? (reversed ? current.danishText : current.englishText) : null;
  // What the typed/recalled answer is graded against.
  const targetText = current ? (isListening ? current.englishText : reversed ? current.danishText : current.englishText) : "";
  const promptText = isListening
    ? "Listen, then recall what it means."
    : reversed
    ? "How do you say this in Danish?"
    : "What does this mean in English?";

  function addToast(toast, ttl = 3200) {
    const id = ++toastIdRef.current;
    setToasts((t) => [...t, { id, ...toast }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), ttl);
  }

  const loadSession = useCallback(async () => {
    setQueue(null);
    setError(null);
    setLastAction(null);
    setToasts([]);
    setCombo(0);
    sessionCelebratedRef.current = false;
    try {
      const [{ cards }, dash] = await Promise.all([
        api.session({ limit: 30, new: 15 }),
        api.dashboard(),
      ]);
      setQueue(cards);
      setCurrent(cards[0] || null);
      setDone(0);
      setXpState({
        xpTotal: dash.xpTotal,
        level: dash.level,
        xpIntoLevel: dash.xpIntoLevel,
        xpForNextLevel: dash.xpForNextLevel,
      });
    } catch (e) {
      setError(e.message);
      setQueue([]);
    }
  }, []);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  // Celebrate reaching the end of a session, once.
  useEffect(() => {
    if (queue !== null && !current && done > 0 && !sessionCelebratedRef.current) {
      sessionCelebratedRef.current = true;
      fireConfetti({ count: 50 });
    }
  }, [queue, current, done]);

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
    const listening = current.cardType === "listening";
    const rev = !listening && direction === "en-da";
    // Don't auto-speak the Danish word when it IS the answer being tested
    // (English -> Danish mode) — that would give it away before reveal.
    if (listening || !rev) speakDanish(current.danishText);
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

  function toggleDirection() {
    setDirection((v) => {
      const next = v === "da-en" ? "en-da" : "da-en";
      localStorage.setItem(DIRECTION_KEY, next);
      return next;
    });
  }

  function checkTyped() {
    if (!typed.trim()) return;
    setResult(gradeAnswer(typed, targetText));
    setRevealed(true);
  }

  async function rate(rating) {
    if (!current || submitting) return;
    setSubmitting(true);
    const ratedCard = current;
    const xpStateBefore = xpState;
    let res;
    try {
      res = await api.review(ratedCard.id, rating);
    } catch (e) {
      setError(e.message);
      setSubmitting(false);
      return;
    }
    const { previous, xpEarned, level, xpIntoLevel, xpForNextLevel, newAchievements } = res;

    setLastAction({
      card: ratedCard,
      previous,
      xpEarned,
      xpStateBefore,
      ratingLabel: RATINGS.find((r) => r.key === rating)?.label || rating,
    });

    if (rating === "again") {
      setCombo(0);
      playAgain();
    } else {
      setCombo((c) => c + 1);
      playCorrect();
    }

    if (xpEarned > 0) {
      setXpFloat(xpEarned);
      setTimeout(() => setXpFloat(null), 1200);
    }

    if (xpStateBefore && level > xpStateBefore.level) {
      addToast({ icon: "⭐", title: `Level ${level}!`, subtitle: "You leveled up." }, 4000);
      fireConfetti({ count: 70 });
      playLevelUp();
    }
    setXpState({ xpTotal: xpStateBefore ? xpStateBefore.xpTotal + xpEarned : xpEarned, level, xpIntoLevel, xpForNextLevel });

    if (newAchievements?.length) {
      newAchievements.forEach((a) =>
        addToast({ icon: a.icon, title: `Achievement: ${a.label}`, subtitle: a.description }, 4000)
      );
      fireConfetti({ count: 60 });
      playAchievement();
    }

    setQueue((prev) => {
      const rest = prev.slice(1);
      // A re-queued card is no longer "new" — next time it's a recall test.
      const next =
        rating === "again" ? [...rest, { ...ratedCard, status: "review" }] : rest;
      setCurrent(next[0] || null);
      return next;
    });
    setDone((d) => d + 1);
    setSubmitting(false);
  }

  async function undoLast() {
    if (!lastAction || submitting) return;
    const { card, previous, xpEarned, xpStateBefore } = lastAction;
    setSubmitting(true);
    try {
      await api.undoReview(card.id, previous, xpEarned);
    } catch (e) {
      setError(e.message);
      setSubmitting(false);
      return;
    }
    setQueue((prev) => [card, ...prev.filter((c) => c.id !== card.id)]);
    setCurrent(card);
    setDone((d) => Math.max(0, d - 1));
    setCombo((c) => Math.max(0, c - 1));
    if (xpStateBefore) setXpState(xpStateBefore);
    setLastAction(null);
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

  const undoBar = lastAction && (
    <div className="undo-bar">
      <span>
        Rated “{lastAction.card.danishText}” as {lastAction.ratingLabel}.
      </span>
      <button className="btn" onClick={undoLast} disabled={submitting}>
        Undo
      </button>
    </div>
  );

  if (!current) {
    return (
      <div className="study-wrap">
        {celebrationStack}
        {undoBar}
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
      {celebrationStack}
      <div className="study-progress">
        <div className="fill" style={{ width: `${pct}%` }} />
      </div>

      {undoBar}

      <div className="spread" style={{ marginBottom: 16 }}>
        <span className="muted" style={{ fontSize: "0.85rem" }}>
          {queue.length} left · {isNew ? "🆕 new" : "🔁 review"}
          {combo >= 2 && <span className="combo-badge">🔥 {combo} in a row</span>}
        </span>
        <div className="row" style={{ gap: 8 }}>
          {!isListening && (
            <button
              className="type-toggle"
              onClick={toggleDirection}
              title="Swap which language you recall"
            >
              {reversed ? "🇬🇧→🇩🇰" : "🇩🇰→🇬🇧"}
            </button>
          )}
          <button
            className={`type-toggle ${typeMode ? "on" : ""}`}
            onClick={toggleTypeMode}
            title="Toggle typing your answer"
          >
            ✍️ Type answer {typeMode ? "on" : "off"}
          </button>
        </div>
      </div>

      <div className={`card flashcard ${isNew ? "is-new" : ""}`}>
        <span className="pill">{current.deckName}</span>

        {isNew && (
          <div className="intro-note">
            {isListening
              ? "🆕 New phrase — listen to it, here's what it means."
              : "🆕 New word — here's what it means. No need to guess."}
          </div>
        )}

        {isListening ? (
          <div className="listening-front">
            <AudioButton text={current.danishText} large />
            {!revealed && <div className="prompt-note muted">{promptText}</div>}
          </div>
        ) : (
          <>
            <div className="row">
              <span className="danish">{frontText}</span>
              {!reversed && <AudioButton text={current.danishText} />}
            </div>
            {!revealed && <div className="prompt-note muted">{promptText}</div>}
          </>
        )}

        {showHint && !revealed && (
          <div className="hint">
            <span className="hint-label">Hint</span>
            <span className="hint-text">{makeHint(targetText)}</span>
          </div>
        )}

        {revealed ? (
          <>
            <div className="divider" />
            {isListening ? (
              <>
                <div className="danish" style={{ fontSize: "1.3rem" }}>{current.danishText}</div>
                <div className="english">{current.englishText}</div>
              </>
            ) : (
              <div className="row">
                <span className={reversed ? "danish" : "english"}>{backText}</span>
                {reversed && <AudioButton text={current.danishText} />}
              </div>
            )}
            {current.exampleSentence &&
              (current.cardType === "grammar" ? (
                <div className="rule-callout">
                  <span className="rule-label">📐 Rule</span>
                  <span className="rule-text">{current.exampleSentence}</span>
                </div>
              ) : (
                <div className="example">{current.exampleSentence}</div>
              ))}
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
              placeholder={
                isListening
                  ? "Type what it means…"
                  : reversed
                  ? "Skriv det danske ord…"
                  : "Type the English meaning…"
              }
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
          {xpFloat && <div className="xp-float">+{xpFloat} XP</div>}
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
