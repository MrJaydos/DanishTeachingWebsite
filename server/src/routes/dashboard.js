import { Router } from "express";
import { prisma } from "../prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { toUtcDate, computeStreak } from "../utils/streak.js";
import { xpProgress } from "../utils/xp.js";

export const dashboardRouter = Router();
dashboardRouter.use(requireAuth);

// Window for the heatmap (26 weeks, GitHub-style) — also generous enough that
// the streak calculation below never runs out of history for realistic streaks.
const HEATMAP_DAYS = 182;

dashboardRouter.get("/", async (req, res) => {
  const userId = req.user.id;
  const now = new Date();
  const visibleCards = { deck: { OR: [{ ownerId: null }, { ownerId: userId }] } };

  const [dueToday, totalCards, inReview, learned, activity, user] = await Promise.all([
    prisma.userCardProgress.count({
      where: { userId, dueDate: { lte: now }, card: visibleCards },
    }),
    prisma.card.count({ where: visibleCards }),
    prisma.userCardProgress.count({ where: { userId } }),
    prisma.userCardProgress.count({ where: { userId, repetitions: { gte: 1 } } }),
    prisma.dailyActivity.findMany({
      where: { userId },
      orderBy: { date: "desc" },
      take: HEATMAP_DAYS,
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { xpTotal: true } }),
  ]);

  // Study reviews and Practice chat messages both count as "activity" for the
  // streak/heatmap/today-count — combine them into one number here so the
  // frontend doesn't need to know about the two underlying counters.
  const activityByDate = new Map(
    activity.map((a) => [
      toUtcDate(new Date(a.date)).toISOString().slice(0, 10),
      a.reviews + a.chatMessages,
    ])
  );

  const newAvailable = totalCards - inReview;
  const today = toUtcDate(now).toISOString().slice(0, 10);
  const reviewsToday = activityByDate.get(today) || 0;

  // Last HEATMAP_DAYS days of review counts, oldest -> newest, for the
  // activity heatmap.
  const recent = [];
  for (let i = HEATMAP_DAYS - 1; i >= 0; i--) {
    const d = toUtcDate(now);
    d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    recent.push({ date: key, reviews: activityByDate.get(key) || 0 });
  }

  res.json({
    dueToday,
    newAvailable,
    totalCards,
    learned,
    inReview,
    streak: computeStreak(activity.map((a) => a.date)),
    reviewsToday,
    recent,
    ...xpProgress(user.xpTotal),
    xpTotal: user.xpTotal,
  });
});
