import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { computeSm2 } from "./sm2.js";

const FRESH = { easeFactor: 2.5, intervalDays: 0, repetitions: 0 };
const NOW = new Date("2026-01-01T00:00:00.000Z");

function daysBetween(a, b) {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

describe("computeSm2", () => {
  test("throws on an invalid rating", () => {
    assert.throws(() => computeSm2(FRESH, "meh", NOW), /Invalid rating/);
  });

  test("first good review schedules a 1-day interval", () => {
    const next = computeSm2(FRESH, "good", NOW);
    assert.equal(next.repetitions, 1);
    assert.equal(next.intervalDays, 1);
    assert.equal(daysBetween(NOW, next.dueDate), 1);
  });

  test("second good review schedules a 6-day interval", () => {
    const first = computeSm2(FRESH, "good", NOW);
    const second = computeSm2(first, "good", NOW);
    assert.equal(second.repetitions, 2);
    assert.equal(second.intervalDays, 6);
  });

  test("third+ good review multiplies the interval by the ease factor", () => {
    const first = computeSm2(FRESH, "good", NOW);
    const second = computeSm2(first, "good", NOW);
    const third = computeSm2(second, "good", NOW);
    assert.equal(third.repetitions, 3);
    assert.equal(third.intervalDays, Math.round(second.intervalDays * second.easeFactor));
  });

  test("'again' (a lapse) resets repetitions and interval to 0", () => {
    const progressed = computeSm2(computeSm2(FRESH, "good", NOW), "good", NOW);
    const lapsed = computeSm2(progressed, "again", NOW);
    assert.equal(lapsed.repetitions, 0);
    assert.equal(lapsed.intervalDays, 0);
    assert.equal(daysBetween(NOW, lapsed.dueDate), 0);
  });

  test("'again' lowers the ease factor", () => {
    const next = computeSm2(FRESH, "again", NOW);
    assert.ok(next.easeFactor < FRESH.easeFactor);
  });

  test("'easy' raises the ease factor", () => {
    const next = computeSm2(FRESH, "easy", NOW);
    assert.ok(next.easeFactor > FRESH.easeFactor);
  });

  test("ease factor never drops below the 1.3 floor even after repeated lapses", () => {
    let state = FRESH;
    for (let i = 0; i < 20; i++) {
      state = computeSm2(state, "again", NOW);
    }
    assert.ok(state.easeFactor >= 1.3);
  });

  test("'hard' advances more conservatively than 'good' from the same state", () => {
    const base = computeSm2(computeSm2(FRESH, "good", NOW), "good", NOW); // repetitions=2, interval=6
    const hard = computeSm2(base, "hard", NOW);
    const good = computeSm2(base, "good", NOW);
    assert.ok(hard.intervalDays <= good.intervalDays);
  });

  test("dueDate is intervalDays after the given 'now'", () => {
    const next = computeSm2(FRESH, "good", NOW);
    assert.equal(daysBetween(NOW, next.dueDate), next.intervalDays);
  });
});
