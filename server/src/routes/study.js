import { Router } from "express";
import { prisma } from "../prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { computeSm2, RATINGS } from "../utils/sm2.js";
import { computeXpForReview, xpProgress } from "../utils/xp.js";
import { checkAndAwardAchievements } from "../utils/achievements.js";

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

  // Snapshot of the state before this review, so the client can offer an
  // "undo" that restores it exactly (null means the card had no progress row
  // yet — undo should delete the row this review creates).
  const previous = existing
    ? {
        easeFactor: existing.easeFactor,
        intervalDays: existing.intervalDays,
        repetitions: existing.repetitions,
        dueDate: existing.dueDate,
        lastReviewedAt: existing.lastReviewedAt,
      }
    : null;

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

  // Award XP (a card's very first review gets a bonus for learning something
  // new), then check whether that pushed any achievement over its threshold.
  const xpEarned = computeXpForReview(rating, previous === null);
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: { xpTotal: { increment: xpEarned } },
    select: { xpTotal: true },
  });
  const newAchievements = await checkAndAwardAchievements(userId);

  res.json({
    progress: {
      cardId,
      repetitions: progress.repetitions,
      intervalDays: progress.intervalDays,
      easeFactor: progress.easeFactor,
      dueDate: progress.dueDate,
    },
    previous,
    xpEarned,
    ...xpProgress(updatedUser.xpTotal),
    newAchievements: newAchievements.map((a) => ({
      key: a.key,
      icon: a.icon,
      label: a.label,
      description: a.description,
    })),
  });
});

// Undo the most recent review of a card, restoring its prior SM-2 state (or
// removing the progress row entirely if the card had none before) and
// decrementing today's activity count. `previous` is exactly what the
// preceding /review response returned in its `previous` field.
studyRouter.post("/review/undo", async (req, res) => {
  const userId = req.user.id;
  const cardId = String(req.body.cardId || "");
  const previous = req.body.previous || null;
  const xpEarned = Number(req.body.xpEarned) || 0;

  const card = await prisma.card.findFirst({
    where: { id: cardId, ...cardVisibility(userId) },
  });
  if (!card) return res.status(404).json({ error: "Card not found." });

  if (previous === null) {
    await prisma.userCardProgress.deleteMany({ where: { userId, cardId } });
  } else {
    await prisma.userCardProgress.updateMany({
      where: { userId, cardId },
      data: {
        easeFactor: previous.easeFactor,
        intervalDays: previous.intervalDays,
        repetitions: previous.repetitions,
        dueDate: new Date(previous.dueDate),
        lastReviewedAt: previous.lastReviewedAt ? new Date(previous.lastReviewedAt) : null,
      },
    });
  }

  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const activity = await prisma.dailyActivity.findUnique({
    where: { userId_date: { userId, date: today } },
  });
  if (activity) {
    if (activity.reviews <= 1) {
      await prisma.dailyActivity.delete({ where: { id: activity.id } });
    } else {
      await prisma.dailyActivity.update({
        where: { id: activity.id },
        data: { reviews: { decrement: 1 } },
      });
    }
  }

  // Revert the XP this review awarded. Achievements are NOT un-earned —
  // they're permanent milestones, and undo is meant to fix a misclick, not
  // erase something the user genuinely did moments ago.
  if (xpEarned > 0) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { xpTotal: true } });
    await prisma.user.update({
      where: { id: userId },
      data: { xpTotal: Math.max(0, user.xpTotal - xpEarned) },
    });
  }

  res.json({ ok: true });
});
