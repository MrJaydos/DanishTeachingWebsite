// Lightweight synthesized sound effects via the Web Audio API — no audio
// files to bundle or fetch. Respects the same mute setting as Danish TTS.

import { isMuted } from "./tts.js";

let ctx;
function getCtx() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!ctx) ctx = new AudioContextClass();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

function tone(audioCtx, startTime, freq, duration, { type = "sine", gain = 0.15 } = {}) {
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(gain, startTime);
  g.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  osc.connect(g);
  g.connect(audioCtx.destination);
  osc.start(startTime);
  osc.stop(startTime + duration);
}

// notes: [frequency, startOffsetSeconds, durationSeconds, toneOptions?][]
function playSequence(notes) {
  if (isMuted()) return;
  const audioCtx = getCtx();
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  notes.forEach(([freq, offset, duration, opts]) => tone(audioCtx, now + offset, freq, duration, opts));
}

// A short upward "ding" for a correct/good/easy rating.
export function playCorrect() {
  playSequence([
    [660, 0, 0.12],
    [880, 0.09, 0.16],
  ]);
}

// A soft low tone for "again" — this is self-paced practice, not a penalty,
// so it's a gentle nudge rather than a harsh buzzer.
export function playAgain() {
  playSequence([[220, 0, 0.18, { gain: 0.1 }]]);
}

// A little arpeggio for unlocking an achievement.
export function playAchievement() {
  playSequence([
    [523.25, 0, 0.14],
    [659.25, 0.1, 0.14],
    [783.99, 0.2, 0.22],
  ]);
}

// A bigger fanfare for leveling up.
export function playLevelUp() {
  playSequence([
    [523.25, 0, 0.12],
    [659.25, 0.1, 0.12],
    [783.99, 0.2, 0.12],
    [1046.5, 0.3, 0.3],
  ]);
}
