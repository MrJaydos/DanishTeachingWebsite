import { Router } from "express";
import { prisma } from "../prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { ACHIEVEMENTS, isAchievementEarned, achievementProgress, computeUserStats } from "../utils/achievements.js";

export const achievementsRouter = Router();
achievementsRouter.use(requireAuth);

// The full "trophy case": every achievement, whether it's earned (and when),
// and — for locked ones with a numeric target — how close the user is.
achievementsRouter.get("/", async (req, res) => {
  const userId = req.user.id;

  const [earnedRows, stats] = await Promise.all([
    prisma.earnedAchievement.findMany({ where: { userId } }),
    computeUserStats(userId),
  ]);
  const earnedByKey = new Map(earnedRows.map((r) => [r.key, r.earnedAt]));

  res.json({
    achievements: ACHIEVEMENTS.map((def) => {
      const earnedAt = earnedByKey.get(def.key) || null;
      return {
        key: def.key,
        icon: def.icon,
        label: def.label,
        description: def.description,
        earned: Boolean(earnedAt) || isAchievementEarned(def, stats),
        earnedAt,
        progress: achievementProgress(def, stats),
      };
    }),
  });
});
