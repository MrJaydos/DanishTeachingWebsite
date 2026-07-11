import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { buildSystemPrompt, sanitizeMessages, toGeminiContents, MAX_MESSAGES, MAX_MESSAGE_LENGTH } from "./chatPrompt.js";

describe("buildSystemPrompt", () => {
  test("falls back to defaults for an unknown scenario/level", () => {
    const fallback = buildSystemPrompt("bogus", "bogus");
    assert.equal(fallback, buildSystemPrompt("small_talk", "beginner"));
  });

  test("includes scenario- and level-specific instructions", () => {
    const prompt = buildSystemPrompt("cafe_shopping", "advanced");
    assert.match(prompt, /café/);
    assert.match(prompt, /fully natural, idiomatic Danish/);
  });

  test("always instructs Danish-only replies and the Tip correction format", () => {
    const prompt = buildSystemPrompt("small_talk", "beginner");
    assert.match(prompt, /Reply ONLY in Danish/);
    assert.match(prompt, /"Tip:"/);
  });
});

describe("sanitizeMessages", () => {
  test("accepts a valid history ending on a user turn", () => {
    const result = sanitizeMessages([
      { role: "assistant", content: "Hej!" },
      { role: "user", content: "Hej hej" },
    ]);
    assert.deepEqual(result, [
      { role: "assistant", content: "Hej!" },
      { role: "user", content: "Hej hej" },
    ]);
  });

  test("rejects a non-array, empty array, or an array over the max length", () => {
    assert.equal(sanitizeMessages(null), null);
    assert.equal(sanitizeMessages("not an array"), null);
    assert.equal(sanitizeMessages([]), null);
    const tooMany = Array.from({ length: MAX_MESSAGES + 1 }, (_, i) => ({
      role: i % 2 === 0 ? "assistant" : "user",
      content: "x",
    }));
    assert.equal(sanitizeMessages(tooMany), null);
  });

  test("rejects a history that doesn't end with a user turn", () => {
    assert.equal(
      sanitizeMessages([
        { role: "user", content: "hi" },
        { role: "assistant", content: "hej" },
      ]),
      null
    );
  });

  test("rejects an invalid role", () => {
    assert.equal(sanitizeMessages([{ role: "system", content: "x" }]), null);
  });

  test("rejects blank/whitespace-only content", () => {
    assert.equal(sanitizeMessages([{ role: "user", content: "   " }]), null);
  });

  test("truncates content to MAX_MESSAGE_LENGTH", () => {
    const [msg] = sanitizeMessages([{ role: "user", content: "x".repeat(3000) }]);
    assert.equal(msg.content.length, MAX_MESSAGE_LENGTH);
  });

  test("trims surrounding whitespace after truncation", () => {
    const [msg] = sanitizeMessages([{ role: "user", content: "  hej  " }]);
    assert.equal(msg.content, "hej");
  });
});

describe("toGeminiContents", () => {
  test("maps assistant -> model, user -> user, wrapping text in parts", () => {
    const result = toGeminiContents([
      { role: "assistant", content: "Hej!" },
      { role: "user", content: "Hej hej" },
    ]);
    assert.deepEqual(result, [
      { role: "model", parts: [{ text: "Hej!" }] },
      { role: "user", parts: [{ text: "Hej hej" }] },
    ]);
  });
});
