import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";

// Bucket a day's review count into a heatmap intensity level (GitHub-style).
function heatLevel(reviews) {
  if (reviews <= 0) return 0;
  if (reviews <= 2) return 1;
  if (reviews <= 5) return 2;
  if (reviews <= 10) return 3;
  return 4;
}

// Pad the front of the (oldest -> newest) activity list with nulls so the
// first real day lines up under its correct weekday column (grid renders
// column-major, Sunday-first, 7 rows tall).
function buildHeatmapCells(recent) {
  if (!recent.length) return [];
  const firstWeekday = new Date(`${recent[0].date}T00:00:00Z`).getUTCDay();
  return [...Array.from({ length: firstWeekday }, () => null), ...recent];
}

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .dashboard()
      .then(setStats)
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="alert error">{error}</div>;
  if (!stats) return <div className="spinner" />;

  const nothingToDo = stats.dueToday === 0 && stats.newAvailable === 0;
  const heatmapCells = buildHeatmapCells(stats.recent);
  const totalInPeriod = stats.recent.reduce((sum, r) => sum + r.reviews, 0);

  return (
    <div>
      <p className="section-title">Your progress</p>
      <h1>Hej{user?.email ? `, ${user.email.split("@")[0]}` : ""} 👋</h1>
      <p className="muted">
        {stats.streak > 0
          ? `You're on a ${stats.streak}-day streak. Keep it going!`
          : "Study today to start a streak."}
      </p>

      <div className="stat-grid">
        <div className="card stat">
          <div className="value">{stats.dueToday}</div>
          <div className="label">Due today</div>
        </div>
        <div className="card stat">
          <div className="value">{stats.learned}</div>
          <div className="label">Cards learned</div>
        </div>
        <div className="card stat">
          <div className="value flame">🔥 {stats.streak}</div>
          <div className="label">Day streak</div>
        </div>
        <div className="card stat">
          <div className="value">{stats.newAvailable}</div>
          <div className="label">New available</div>
        </div>
      </div>

      <div className="card" style={{ padding: 24, marginBottom: 24 }}>
        <div className="spread">
          <div>
            <p className="section-title" style={{ marginBottom: 4 }}>
              Today's session
            </p>
            <div className="muted">
              {nothingToDo
                ? "All caught up — nothing due right now. 🎉"
                : `${stats.dueToday} due + up to ${Math.min(
                    stats.newAvailable,
                    15
                  )} new cards ready to review.`}
            </div>
          </div>
          <Link className="btn primary" to="/study">
            {nothingToDo ? "Review anyway" : "Start studying"}
          </Link>
        </div>
      </div>

      <div className="card" style={{ padding: 24 }}>
        <div className="spread">
          <p className="section-title">Activity — last {stats.recent.length} days</p>
          <span className="muted" style={{ fontSize: "0.85rem" }}>
            {totalInPeriod} review{totalInPeriod === 1 ? "" : "s"}
          </span>
        </div>
        <div className="heatmap-scroll">
          <div className="heatmap">
            {heatmapCells.map((c, i) => (
              <div
                key={c ? c.date : `pad-${i}`}
                className={`heatmap-cell${c ? ` level-${heatLevel(c.reviews)}` : " empty"}`}
                title={c ? `${c.reviews} review${c.reviews === 1 ? "" : "s"} on ${c.date}` : ""}
              />
            ))}
          </div>
        </div>
        <div className="heatmap-legend">
          <span className="muted">Less</span>
          {[0, 1, 2, 3, 4].map((lvl) => (
            <div key={lvl} className={`heatmap-cell level-${lvl}`} />
          ))}
          <span className="muted">More</span>
        </div>
        <p className="muted" style={{ marginTop: 12, fontSize: "0.85rem" }}>
          {stats.reviewsToday} review{stats.reviewsToday === 1 ? "" : "s"} today ·{" "}
          {stats.inReview} cards in rotation
        </p>
      </div>
    </div>
  );
}
