import { Router } from "express";
import rateLimit from "express-rate-limit";
import { GoogleGenAI } from "@google/genai";
import { config } from "../config.js";
import { requireAuth } from "../middleware/auth.js";

export const chatRouter = Router();
chatRouter.use(requireAuth);

// Keep the conversation bounded — a few dozen turns is plenty for a practice
// session and caps worst-case cost/latency per request.
const MAX_MESSAGES = 40;
const MAX_MESSAGE_LENGTH = 2000;
const MAX_TOKENS = 400;

const chatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many messages, please slow down." },
});

const SCENARIOS = {
  small_talk: "casual small talk: greetings, how someone is doing, weekend plans, the weather",
  cafe_shopping: "ordering at a café and shopping: ordering food or drinks, asking prices, paying",
  everyday_phrases: "everyday practical situations: asking for directions, introducing yourself, making small requests",
};

const LEVELS = {
  beginner: "Use only very simple present-tense Danish, common everyday words, and short sentences (roughly 3-6 words). Avoid idioms.",
  intermediate: "Use natural conversational Danish with a moderate vocabulary. Occasional common idioms are fine. Sentences can be a bit longer.",
  advanced: "Use fully natural, idiomatic Danish the way a native speaker would talk, including casual expressions. Don't simplify.",
};

function buildSystemPrompt(scenario, level) {
  const scenarioDesc = SCENARIOS[scenario] || SCENARIOS.small_talk;
  const levelDesc = LEVELS[level] || LEVELS.beginner;
  return `You are a friendly Danish conversation partner helping someone practice spoken Danish.

Scenario: ${scenarioDesc}
Level: ${levelDesc}

Rules:
- Reply ONLY in Danish, staying in character for the scenario.
- Keep each reply short — 1 to 3 sentences, like a real back-and-forth conversational turn, not an essay.
- Match the vocabulary and sentence complexity to the level described above.
- If the user's most recent Danish message has a clear grammar or word-choice mistake, end your reply with a new line starting with "Tip:" followed by a brief, encouraging correction in English. Omit the Tip line entirely if there's nothing meaningful to correct.
- Never break character to explain that you are an AI.`;
}

function sanitizeMessages(raw) {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_MESSAGES) return null;
  const messages = [];
  for (const m of raw) {
    if (!m || (m.role !== "user" && m.role !== "assistant")) return null;
    const content = String(m.content || "").slice(0, MAX_MESSAGE_LENGTH).trim();
    if (!content) return null;
    messages.push({ role: m.role, content });
  }
  if (messages[messages.length - 1].role !== "user") return null;
  return messages;
}

// Gemini's Content role for a model turn is "model", not "assistant" — the
// client-facing message shape stays {role: "user"|"assistant", content} and
// gets translated at this boundary.
function toGeminiContents(messages) {
  return messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
}

// Stream a Danish conversation-practice reply as Server-Sent Events.
chatRouter.post("/reply", chatLimiter, async (req, res) => {
  if (!config.gemini.apiKey) {
    return res.status(503).json({
      error: "Practice chat isn't configured yet — a GEMINI_API_KEY needs to be set.",
    });
  }

  const scenario = String(req.body.scenario || "small_talk");
  const level = String(req.body.level || "beginner");
  const messages = sanitizeMessages(req.body.messages);
  if (!messages) {
    return res.status(400).json({ error: "messages must be a non-empty array ending with a user turn." });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const ai = new GoogleGenAI({ apiKey: config.gemini.apiKey });

  try {
    const stream = await ai.models.generateContentStream({
      model: config.gemini.model,
      contents: toGeminiContents(messages),
      config: {
        systemInstruction: buildSystemPrompt(scenario, level),
        maxOutputTokens: MAX_TOKENS,
      },
    });

    for await (const chunk of stream) {
      if (chunk.text) {
        res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
      }
    }
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  } catch (err) {
    console.error("Practice chat error:", err);
    res.write(`data: ${JSON.stringify({ error: "Something went wrong talking to Gemini." })}\n\n`);
  } finally {
    res.end();
  }
});
