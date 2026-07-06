import { Router } from "express";
import { prisma } from "../prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { computeSm2, RATINGS } from "../utils/sm2.js";

export const studyRouter = Router();
studyRouter.use(requireAuth);

const DEFAULT_NEW_PER_SESSION = 15;
const DEFAULT_SESSION_LIMIT = 30;

function cardVisibility(userId, deckId) {
  return {
    deck: { OR: [{ ownerId: null }, { ownerId: userId }] },
    ...(deckId ? { deckId } : {}),
  };
}

function serializeCard(c) {
  return {
    id: c.id,
    deckId: c.deckId,
    deckName: c.deck?.name,
    danishText: c.danishText,
    englishText: c.englishText,
    exampleSentence: c.exampleSentence,
    cardType: c.cardType,
  };
}

// Build a study session: cards already in review that are due now, plus a
// capped number of brand-new cards the user hasn't seen yet.
studyRouter.get("/session", async (req, res) => {
  const userId = req.user.id;
  const deckId = req.query.deckId ? String(req.query.deckId) : undefined;
  const limit = Math.min(parseInt(req.query.limit, 10) || DEFAULT_SESSION_LIMIT, 100);
  const newLimit = Math.min(
    parseInt(req.query.new, 10) || DEFAULT_NEW_PER_SESSION,
    100
  );
  const now = new Date();

  // 1) Due cards (already have progress and due_date <= now).
  const dueProgress = await prisma.userCardProgress.findMany({
    where: {
      userId,
      dueDate: { lte: now },
      card: cardVisibility(userId, deckId),
    },
    orderBy: { dueDate: "asc" },
    take: limit,
    include: { card: { include: { deck: { select: { name: true } } } } },
  });

  const dueCards = dueProgress.map((p) => ({
    ...serializeCard(p.card),
    status: "review",
  }));

  // 2) New cards (no progress row yet for this user), to fill the session.
  const remaining = Math.max(0, limit - dueCards.length);
  let newCards = [];
  if (remaining > 0 && newLimit > 0) {
    const fresh = await prisma.card.findMany({
      where: {
        ...cardVisibility(userId, deckId),
        progress: { none: { userId } },
      },
      orderBy: { createdAt: "asc" },
      take: Math.min(remaining, newLimit),
      include: { deck: { select: { name: true } } },
    });
    newCards = fresh.map((c) => ({ ...serializeCard(c), status: "new" }));
  }

  res.json({
    cards: [...dueCards, ...newCards],
    counts: { due: dueCards.length, new: newCards.length },
  });
});

// Record a review: update the card's SM-2 state and log daily activity.
studyRouter.post("/review", async (req, res) => {
  const userId = req.user.id;
  const cardId = String(req.body.cardId || "");
  const rating = String(req.body.rating || "");

  if (!(rating in RATINGS)) {
    return res.status(400).json({ error: "rating must be one of: again, hard, good, easy" });
  }

  // Ensure the card exists and is visible to this user.
  const card = await prisma.card.findFirst({
    where: { id: cardId, ...cardVisibility(userId) },
  });
  if (!card) return res.status(404).json({ error: "Card not found." });

  const existing = await prisma.userCardProgress.findUnique({
    where: { userId_cardId: { userId, cardId } },
  });

  const state = existing
    ? {
        easeFactor: existing.easeFactor,
        intervalDays: existing.intervalDays,
        repetitions: existing.repetitions,
      }
    : { easeFactor: 2.5, intervalDays: 0, repetitions: 0 };

  const now = new Date();
  const next = computeSm2(state, rating, now);

  const progress = await prisma.userCardProgress.upsert({
    where: { userId_cardId: { userId, cardId } },
    create: {
      userId,
      cardId,
      easeFactor: next.easeFactor,
      intervalDays: next.intervalDays,
      repetitions: next.repetitions,
      dueDate: next.dueDate,
      lastReviewedAt: now,
    },
    update: {
      easeFactor: next.easeFactor,
      intervalDays: next.intervalDays,
      repetitions: next.repetitions,
      dueDate: next.dueDate,
      lastReviewedAt: now,
    },
  });

  // Log today's activity (one row per user per day) for streak tracking.
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  await prisma.dailyActivity.upsert({
    where: { userId_date: { userId, date: today } },
    create: { userId, date: today, reviews: 1 },
    update: { reviews: { increment: 1 } },
  });

  res.json({
    progress: {
      cardId,
      repetitions: progress.repetitions,
      intervalDays: progress.intervalDays,
      easeFactor: progress.easeFactor,
      dueDate: progress.dueDate,
    },
  });
});
