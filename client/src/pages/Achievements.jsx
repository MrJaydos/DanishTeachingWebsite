import { useEffect, useState } from "react";
import { api } from "../api.js";

export default function Achievements() {
  const [achievements, setAchievements] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .achievements()
      .then(({ achievements }) => setAchievements(achievements))
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="alert error">{error}</div>;
  if (!achievements) return <div className="spinner" />;

  const earnedCount = achievements.filter((a) => a.earned).length;

  return (
    <div>
      <p className="section-title">Trophy case</p>
      <h1>Achievements</h1>
      <p className="muted" style={{ marginBottom: 20 }}>
        {earnedCount} / {achievements.length} unlocked
      </p>

      <div className="achievement-grid">
        {achievements.map((a) => (
          <div key={a.key} className={`card achievement-card ${a.earned ? "earned" : "locked"}`}>
            <span className="achievement-icon">{a.icon}</span>
            <span className="achievement-label">{a.label}</span>
            <span className="muted achievement-desc">{a.description}</span>
            {a.earned ? (
              a.earnedAt && (
                <span className="achievement-date">
                  Earned {new Date(a.earnedAt).toLocaleDateString()}
                </span>
              )
            ) : a.progress ? (
              <div className="achievement-progress">
                <div className="achievement-progress-bar">
                  <div
                    className="achievement-progress-fill"
                    style={{ width: `${(a.progress.current / a.progress.target) * 100}%` }}
                  />
                </div>
                <span className="muted" style={{ fontSize: "0.75rem" }}>
                  {a.progress.current} / {a.progress.target}
                </span>
              </div>
            ) : (
              <span className="achievement-date muted">Locked</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
