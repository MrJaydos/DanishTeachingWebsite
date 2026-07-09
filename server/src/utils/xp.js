// XP and levelling. Kept deliberately simple (flat cost per level) so the
// curve is easy to reason about and to re-tune later without touching
// stored data — everything here is derived from a single xpTotal on User.

const RATING_XP = { again: 0, hard: 2, good: 5, easy: 8 };
const BASE_XP_PER_REVIEW = 5;
const FIRST_LEARN_BONUS = 10;
const XP_PER_LEVEL = 100;

/**
 * @param {"again"|"hard"|"good"|"easy"} rating
 * @param {boolean} isFirstReview true if the card had no prior progress row
 */
export function computeXpForReview(rating, isFirstReview) {
  const bonus = RATING_XP[rating] ?? 0;
  return BASE_XP_PER_REVIEW + bonus + (isFirstReview ? FIRST_LEARN_BONUS : 0);
}

export function levelForXp(xpTotal) {
  return Math.floor(xpTotal / XP_PER_LEVEL) + 1;
}

// Returns { level, xpIntoLevel, xpForNextLevel } for rendering a progress bar.
export function xpProgress(xpTotal) {
  const level = levelForXp(xpTotal);
  const xpIntoLevel = xpTotal % XP_PER_LEVEL;
  return { level, xpIntoLevel, xpForNextLevel: XP_PER_LEVEL };
}
