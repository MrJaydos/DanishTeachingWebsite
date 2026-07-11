import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.forgotPassword(email);
      // The API always responds the same way whether or not the email
      // exists, so this message is accurate regardless.
      setSent(true);
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
          JabberYap
        </div>
        <p className="auth-sub">
          Enter your email and we'll send you a link to reset your password.
        </p>

        {error && <div className="alert error">{error}</div>}

        {sent ? (
          <div className="alert">
            If an account exists for that email, a reset link has been sent.
          </div>
        ) : (
          <form onSubmit={onSubmit}>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                className="input"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <button className="btn primary block" type="submit" disabled={busy}>
              {busy ? "Sending…" : "Send reset link"}
            </button>
          </form>
        )}

        <div className="toggle-line">
          <Link to="/login">← Back to login</Link>
        </div>
      </div>
    </div>
  );
}
