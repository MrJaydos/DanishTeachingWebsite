import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { ACHIEVEMENTS, isAchievementEarned, achievementProgress } from "./achievements.js";

describe("achievement catalogue", () => {
  test("every achievement has a unique key", () => {
    const keys = ACHIEVEMENTS.map((a) => a.key);
    assert.equal(new Set(keys).size, keys.length);
  });

  test("every achievement has an icon, label, and description", () => {
    for (const a of ACHIEVEMENTS) {
      assert.ok(a.icon, `${a.key} missing icon`);
      assert.ok(a.label, `${a.key} missing label`);
      assert.ok(a.description, `${a.key} missing description`);
    }
  });

  test("every target is either a number or exactly true", () => {
    for (const a of ACHIEVEMENTS) {
      assert.ok(typeof a.target === "number" || a.target === true, `${a.key} has an invalid target`);
    }
  });
});

describe("isAchievementEarned", () => {
  test("numeric target: earned once the metric reaches or exceeds it", () => {
    const def = { metric: "learned", target: 25 };
    assert.equal(isAchievementEarned(def, { learned: 24 }), false);
    assert.equal(isAchievementEarned(def, { learned: 25 }), true);
    assert.equal(isAchievementEarned(def, { learned: 100 }), true);
  });

  test("boolean target: earned only when the metric is exactly true", () => {
    const def = { metric: "polyglot", target: true };
    assert.equal(isAchievementEarned(def, { polyglot: false }), false);
    assert.equal(isAchievementEarned(def, { polyglot: true }), true);
  });
});

describe("achievementProgress", () => {
  test("returns null for boolean-target achievements (no meaningful progress bar)", () => {
    assert.equal(achievementProgress({ metric: "deckCompleted", target: true }, { deckCompleted: false }), null);
  });

  test("clamps current progress at the target for numeric achievements", () => {
    const def = { metric: "streak", target: 7 };
    assert.deepEqual(achievementProgress(def, { streak: 3 }), { current: 3, target: 7 });
    assert.deepEqual(achievementProgress(def, { streak: 10 }), { current: 7, target: 7 });
  });
});
