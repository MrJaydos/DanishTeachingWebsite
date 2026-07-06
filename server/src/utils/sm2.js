// SM-2 spaced-repetition algorithm (the classic SuperMemo 2 / Anki-style scheme).
//
// The four review buttons map to a "quality" score:
//   again -> 0   (failed recall; card is relearned)
//   hard  -> 3   (recalled with serious difficulty)
//   good  -> 4   (recalled correctly)
//   easy  -> 5   (recalled effortlessly)
//
// Given the current progress state and a rating, we return the next
// { easeFactor, intervalDays, repetitions, dueDate }.

export const RATINGS = {
  again: 0,
  hard: 3,
  good: 4,
  easy: 5,
};

const MIN_EASE = 1.3;

/**
 * @param {{ easeFactor:number, intervalDays:number, repetitions:number }} state
 * @param {"again"|"hard"|"good"|"easy"} rating
 * @param {Date} [now]
 */
export function computeSm2(state, rating, now = new Date()) {
  const quality = RATINGS[rating];
  if (quality === undefined) {
    throw new Error(`Invalid rating: ${rating}`);
  }

  let { easeFactor, intervalDays, repetitions } = state;

  if (quality < 3) {
    // Lapse: reset the streak. The card becomes due again immediately so it
    // reappears in the current study session.
    repetitions = 0;
    intervalDays = 0;
  } else {
    if (repetitions === 0) {
      intervalDays = 1;
    } else if (repetitions === 1) {
      intervalDays = 6;
    } else {
      let factor = easeFactor;
      // "Hard" advances more conservatively than the full ease factor.
      if (rating === "hard") factor = Math.max(MIN_EASE, easeFactor * 0.8);
      intervalDays = Math.round(intervalDays * factor);
    }
    repetitions += 1;
  }

  // Update the ease factor per the SM-2 formula.
  easeFactor =
    easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  if (easeFactor < MIN_EASE) easeFactor = MIN_EASE;

  const dueDate = new Date(now);
  dueDate.setDate(dueDate.getDate() + intervalDays);

  return {
    easeFactor: Number(easeFactor.toFixed(4)),
    intervalDays,
    repetitions,
    dueDate,
  };
}
