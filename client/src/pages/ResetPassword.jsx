import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api.js";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      await api.resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="card auth-card">
        <div className="brand">
          <span className="dot" />
          Dansk
        </div>

        {!token ? (
          <div className="alert error">
            This link is missing its reset token. Request a new one from the{" "}
            <Link to="/forgot-password">forgot password</Link> page.
          </div>
        ) : done ? (
          <>
            <div className="alert">Your password has been reset.</div>
            <div className="toggle-line">
              <Link to="/login">Continue to login →</Link>
            </div>
          </>
        ) : (
          <>
            <p className="auth-sub">Choose a new password.</p>
            {error && <div className="alert error">{error}</div>}
            <form onSubmit={onSubmit}>
              <div className="field">
                <label htmlFor="password">New password</label>
                <input
                  id="password"
                  className="input"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="confirm">Confirm new password</label>
                <input
                  id="confirm"
                  className="input"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  minLength={8}
                  required
                />
              </div>
              <button className="btn primary block" type="submit" disabled={busy}>
                {busy ? "Resetting…" : "Reset password"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
