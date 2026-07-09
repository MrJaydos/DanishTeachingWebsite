// Shared by the dashboard (display) and achievements (streak badges).

export function toUtcDate(d) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

// Count consecutive days (ending today or yesterday) that have activity.
export function computeStreak(activityDates) {
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
