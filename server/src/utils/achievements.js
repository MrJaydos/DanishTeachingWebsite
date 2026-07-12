// Achievement catalogue + the stats they're evaluated against. Each
// achievement is declarative: a metric name (looked up on the stats object
// returned by computeUserStats) and a target — a number to reach/exceed, or
// `true` for a boolean milestone. Earned achievements are permanent (see
// EarnedAchievement in schema.prisma) even if the triggering review is later
// undone.

import { prisma } from "../prisma.js";
import { computeStreak } from "./streak.js";

export const ACHIEVEMENTS = [
  { key: "first_review", icon: "🎉", label: "First Steps", description: "Complete your first review or practice message.", metric: "lifetimeReviews", target: 1 },
  { key: "streak_3", icon: "🔥", label: "Getting Started", description: "Reach a 3-day streak.", metric: "streak", target: 3 },
  { key: "streak_7", icon: "🔥", label: "Week Warrior", description: "Reach a 7-day streak.", metric: "streak", target: 7 },
  { key: "streak_30", icon: "🔥", label: "Unstoppable", description: "Reach a 30-day streak.", metric: "streak", target: 30 },
  { key: "streak_100", icon: "🔥", label: "Centurion Streak", description: "Reach a 100-day streak.", metric: "streak", target: 100 },
  { key: "learned_25", icon: "📚", label: "Vocabulary Builder", description: "Learn 25 cards.", metric: "learned", target: 25 },
  { key: "learned_100", icon: "📚", label: "Word Collector", description: "Learn 100 cards.", metric: "learned", target: 100 },
  { key: "learned_250", icon: "📚", label: "Walking Dictionary", description: "Learn 250 cards.", metric: "learned", target: 250 },
  { key: "reviews_100", icon: "💪", label: "Century of Reviews", description: "Complete 100 reviews or practice messages.", metric: "lifetimeReviews", target: 100 },
  { key: "reviews_500", icon: "💪", label: "Dedicated Learner", description: "Complete 500 reviews or practice messages.", metric: "lifetimeReviews", target: 500 },
  { key: "reviews_1000", icon: "💪", label: "Review Machine", description: "Complete 1000 reviews or practice messages.", metric: "lifetimeReviews", target: 1000 },
  { key: "deck_complete", icon: "🏆", label: "Deck Master", description: "Fully learn every card in a deck.", metric: "deckCompleted", target: true },
  { key: "polyglot", icon: "🌍", label: "Well-Rounded", description: "Learn at least one word, one grammar point, and one listening phrase.", metric: "polyglot", target: true },
];

export function isAchievementEarned(def, stats) {
  const value = stats[def.metric];
  return typeof def.target === "boolean" ? Boolean(value) === def.target : value >= def.target;
}

// For locked achievements with a numeric target, how close the user is.
export function achievementProgress(def, stats) {
  if (typeof def.target === "boolean") return null;
  return { current: Math.min(stats[def.metric], def.target), target: def.target };
}

// Gathers everything ACHIEVEMENTS definitions check against, for one user.
export async function computeUserStats(userId) {
  const [activity, learned, reviewSum, deckRows, learnedCards] = await Promise.all([
    prisma.dailyActivity.findMany({ where: { userId }, select: { date: true } }),
    prisma.userCardProgress.count({ where: { userId, repetitions: { gte: 1 } } }),
    prisma.dailyActivity.aggregate({ where: { userId }, _sum: { reviews: true, chatMessages: true } }),
    prisma.$queryRaw`
      SELECT COUNT(c.id)::int AS total, COUNT(CASE WHEN p.repetitions >= 1 THEN 1 END)::int AS learned
      FROM decks d
      JOIN cards c ON c.deck_id = d.id
      LEFT JOIN user_card_progress p ON p.card_id = c.id AND p.user_id = ${userId}
      WHERE d.owner_id IS NULL OR d.owner_id = ${userId}
      GROUP BY d.id
      HAVING COUNT(c.id) > 0
    `,
    prisma.userCardProgress.findMany({
      where: { userId, repetitions: { gte: 1 } },
      select: { card: { select: { cardType: true } } },
    }),
  ]);

  const learnedTypes = new Set(learnedCards.map((r) => r.card.cardType));

  return {
    streak: computeStreak(activity.map((a) => a.date)),
    learned,
    lifetimeReviews: (reviewSum._sum.reviews || 0) + (reviewSum._sum.chatMessages || 0),
    deckCompleted: deckRows.some((d) => d.total > 0 && d.total === d.learned),
    polyglot: learnedTypes.has("vocab") && learnedTypes.has("grammar") && learnedTypes.has("listening"),
  };
}

// Checks all achievements against current stats and persists any newly
// earned ones. Returns the list of defs that were newly earned by this call
// (empty if none), for the caller to surface as a celebration.
export async function checkAndAwardAchievements(userId) {
  const stats = await computeUserStats(userId);
  const alreadyEarned = new Set(
    (await prisma.earnedAchievement.findMany({ where: { userId }, select: { key: true } })).map(
      (r) => r.key
    )
  );

  const newlyEarned = ACHIEVEMENTS.filter(
    (def) => !alreadyEarned.has(def.key) && isAchievementEarned(def, stats)
  );

  if (newlyEarned.length > 0) {
    await prisma.earnedAchievement.createMany({
      data: newlyEarned.map((def) => ({ userId, key: def.key })),
      skipDuplicates: true,
    });
  }

  return newlyEarned;
}
