import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  computeXpForReview,
  levelForXp,
  xpProgress,
  computeXpForChatMessage,
  CHAT_MESSAGE_XP,
  CHAT_XP_DAILY_CAP,
} from "./xp.js";

describe("computeXpForReview", () => {
  test("awards base + rating bonus, no first-learn bonus on a repeat review", () => {
    assert.equal(computeXpForReview("again", false), 5);
    assert.equal(computeXpForReview("hard", false), 7);
    assert.equal(computeXpForReview("good", false), 10);
    assert.equal(computeXpForReview("easy", false), 13);
  });

  test("adds the first-learn bonus when the card had no prior progress", () => {
    assert.equal(computeXpForReview("good", true), 20);
  });

  test("unknown ratings just get the base amount (no bonus)", () => {
    assert.equal(computeXpForReview("bogus", false), 5);
  });
});

describe("levelForXp / xpProgress", () => {
  test("starts at level 1 with zero XP", () => {
    assert.equal(levelForXp(0), 1);
  });

  test("levels up every 100 XP", () => {
    assert.equal(levelForXp(99), 1);
    assert.equal(levelForXp(100), 2);
    assert.equal(levelForXp(250), 3);
  });

  test("xpProgress reports the level and progress within it", () => {
    assert.deepEqual(xpProgress(0), { level: 1, xpIntoLevel: 0, xpForNextLevel: 100 });
    assert.deepEqual(xpProgress(150), { level: 2, xpIntoLevel: 50, xpForNextLevel: 100 });
    assert.deepEqual(xpProgress(100), { level: 2, xpIntoLevel: 0, xpForNextLevel: 100 });
  });
});

describe("computeXpForChatMessage", () => {
  test("awards the flat per-message amount under the daily cap", () => {
    assert.equal(computeXpForChatMessage(1), CHAT_MESSAGE_XP);
    assert.equal(computeXpForChatMessage(CHAT_XP_DAILY_CAP), CHAT_MESSAGE_XP);
  });

  test("awards nothing once the daily cap is exceeded", () => {
    assert.equal(computeXpForChatMessage(CHAT_XP_DAILY_CAP + 1), 0);
    assert.equal(computeXpForChatMessage(CHAT_XP_DAILY_CAP + 50), 0);
  });

  test("chat messages are worth meaningfully less than a study review", () => {
    assert.ok(CHAT_MESSAGE_XP < computeXpForReview("again", false));
  });
});
