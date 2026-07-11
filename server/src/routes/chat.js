import { Router } from "express";
import rateLimit from "express-rate-limit";
import { GoogleGenAI } from "@google/genai";
import { config } from "../config.js";
import { prisma } from "../prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { computeXpForChatMessage, xpProgress } from "../utils/xp.js";
import { checkAndAwardAchievements } from "../utils/achievements.js";
import { buildSystemPrompt, sanitizeMessages, toGeminiContents } from "../utils/chatPrompt.js";

export const chatRouter = Router();
chatRouter.use(requireAuth);

const MAX_TOKENS = 400;

const chatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many messages, please slow down." },
});

// Stream a Danish conversation-practice reply as Server-Sent Events.
chatRouter.post("/reply", chatLimiter, async (req, res) => {
  if (!config.gemini.apiKey) {
    return res.status(503).json({
      error: "Practice chat isn't configured yet — a GEMINI_API_KEY needs to be set.",
    });
  }

  const scenario = String(req.body.scenario || "small_talk");
  const level = String(req.body.level || "beginner");
  const language = String(req.body.language || "da");
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
        systemInstruction: buildSystemPrompt(scenario, level, language),
        maxOutputTokens: MAX_TOKENS,
      },
    });

    for await (const chunk of stream) {
      if (chunk.text) {
        res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
      }
    }

    // A completed reply counts as practice: log today's activity (same table
    // study reviews use, so it contributes to the streak/heatmap too), award
    // a small capped amount of XP, and check for newly-earned achievements.
    const userId = req.user.id;
    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const activity = await prisma.dailyActivity.upsert({
      where: { userId_date: { userId, date: today } },
      create: { userId, date: today, chatMessages: 1 },
      update: { chatMessages: { increment: 1 } },
    });

    const xpEarned = computeXpForChatMessage(activity.chatMessages);
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { xpTotal: { increment: xpEarned } },
      select: { xpTotal: true },
    });
    const newAchievements = await checkAndAwardAchievements(userId);

    res.write(
      `data: ${JSON.stringify({
        done: true,
        xpEarned,
        ...xpProgress(updatedUser.xpTotal),
        newAchievements: newAchievements.map((a) => ({
          key: a.key,
          icon: a.icon,
          label: a.label,
          description: a.description,
        })),
      })}\n\n`
    );
  } catch (err) {
    console.error("Practice chat error:", err);
    res.write(`data: ${JSON.stringify({ error: "Something went wrong talking to Gemini." })}\n\n`);
  } finally {
    res.end();
  }
});
