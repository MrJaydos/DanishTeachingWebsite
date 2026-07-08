import { Router } from "express";
import { prisma } from "../prisma.js";
import { requireAuth } from "../middleware/auth.js";

export const dashboardRouter = Router();
dashboardRouter.use(requireAuth);

function toUtcDate(d) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

// Window for the heatmap (26 weeks, GitHub-style) — also generous enough that
// the streak calculation below never runs out of history for realistic streaks.
const HEATMAP_DAYS = 182;

// Count consecutive days (ending today or yesterday) that have activity.
function computeStreak(activityDates) {
  const set = new Set(
    activityDates.map((d) => toUtcDate(new Date(d)).toISOString().slice(0, 10))
  );
  let streak = 0;
  const cursor = toUtcDate(new Date());

  // Allow the streak to still "count" if the user hasn't studied yet today but
  // did yesterday.
  if (!set.has(cursor.toISOString().slice(0, 10))) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
    if (!set.has(cursor.toISOString().slice(0, 10))) return 0;
  }

  while (set.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

dashboardRouter.get("/", async (req, res) => {
  const userId = req.user.id;
  const now = new Date();
  const visibleCards = { deck: { OR: [{ ownerId: null }, { ownerId: userId }] } };

  const [dueToday, totalCards, inReview, learned, activity] = await Promise.all([
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
  ]);

  const activityByDate = new Map(
    activity.map((a) => [toUtcDate(new Date(a.date)).toISOString().slice(0, 10), a.reviews])
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
  });
});
