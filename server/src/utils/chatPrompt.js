// Pure prompt-building and validation logic for the Practice chatbot, kept
// separate from the Express route so it can be unit-tested without pulling
// in the DB, the Gemini SDK, or config (which requires DATABASE_URL).

export const MAX_MESSAGES = 40;
export const MAX_MESSAGE_LENGTH = 2000;

const SCENARIOS = {
  small_talk: "casual small talk: greetings, how someone is doing, weekend plans, the weather",
  cafe_shopping: "ordering at a café and shopping: ordering food or drinks, asking prices, paying",
  everyday_phrases: "everyday practical situations: asking for directions, introducing yourself, making small requests",
};

const LEVELS = {
  beginner: "Use only very simple present-tense {LANG}, common everyday words, and short sentences (roughly 3-6 words). Avoid idioms.",
  intermediate: "Use natural conversational {LANG} with a moderate vocabulary. Occasional common idioms are fine. Sentences can be a bit longer.",
  advanced: "Use fully natural, idiomatic {LANG} the way a native speaker would talk, including casual expressions. Don't simplify.",
};

// Language code (matches Deck.language) -> the English name used in the
// prompt text. Extend this alongside client/src/tts.js's LANG_TAGS when
// adding a new target language.
const LANGUAGES = {
  da: "Danish",
  ja: "Japanese",
};

export function buildSystemPrompt(scenario, level, languageCode = "da") {
  const language = LANGUAGES[languageCode] || LANGUAGES.da;
  const scenarioDesc = SCENARIOS[scenario] || SCENARIOS.small_talk;
  const levelDesc = (LEVELS[level] || LEVELS.beginner).replaceAll("{LANG}", language);
  return `You are a friendly ${language} conversation partner helping someone practice spoken ${language}.

Scenario: ${scenarioDesc}
Level: ${levelDesc}

Rules:
- Reply ONLY in ${language}, staying in character for the scenario.
- Keep each reply short — 1 to 3 sentences, like a real back-and-forth conversational turn, not an essay.
- Match the vocabulary and sentence complexity to the level described above.
- If the user's most recent message has a clear grammar or word-choice mistake, end your reply with a new line starting with "Tip:" followed by a brief, encouraging correction in English. Omit the Tip line entirely if there's nothing meaningful to correct.
- Never break character to explain that you are an AI.`;
}

export function sanitizeMessages(raw) {
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
export function toGeminiContents(messages) {
  return messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
}
