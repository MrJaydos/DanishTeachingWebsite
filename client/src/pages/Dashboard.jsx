import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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

  const maxReviews = Math.max(1, ...stats.recent.map((r) => r.reviews));
  const nothingToDo = stats.dueToday === 0 && stats.newAvailable === 0;

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
        <p className="section-title">Last 7 days</p>
        <div className="activity">
          {stats.recent.map((r) => (
            <div
              key={r.date}
              className={`bar ${r.reviews > 0 ? "has" : ""}`}
              style={{ height: `${(r.reviews / maxReviews) * 100}%` }}
              title={`${r.reviews} reviews on ${r.date}`}
            />
          ))}
        </div>
        <div className="activity-labels">
          {stats.recent.map((r) => (
            <span key={r.date}>{WEEKDAYS[new Date(r.date).getUTCDay()]}</span>
          ))}
        </div>
        <p className="muted" style={{ marginTop: 12, fontSize: "0.85rem" }}>
          {stats.reviewsToday} review{stats.reviewsToday === 1 ? "" : "s"} today ·{" "}
          {stats.inReview} cards in rotation
        </p>
      </div>
    </div>
  );
}
