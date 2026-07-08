import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function Login() {
  const { login, signup } = useAuth();
  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const isSignup = mode === "signup";

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (isSignup) await signup(email, password);
      else await login(email, password);
      // On success the AuthProvider sets the user and the router redirects.
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
        <p className="auth-sub">
          {isSignup
            ? "Create an account to track your progress."
            : "Welcome back — log in to keep learning Danish."}
        </p>

        {error && <div className="alert error">{error}</div>}

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
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              className="input"
              type="password"
              autoComplete={isSignup ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={isSignup ? 8 : undefined}
              required
            />
            {isSignup && (
              <div className="muted" style={{ fontSize: "0.8rem", marginTop: 6 }}>
                At least 8 characters.
              </div>
            )}
            {!isSignup && (
              <div style={{ textAlign: "right", marginTop: 6 }}>
                <Link to="/forgot-password" style={{ fontSize: "0.85rem" }}>
                  Forgot password?
                </Link>
              </div>
            )}
          </div>

          <button className="btn primary block" type="submit" disabled={busy}>
            {busy ? "Please wait…" : isSignup ? "Create account" : "Log in"}
          </button>
        </form>

        <div className="toggle-line">
          {isSignup ? "Already have an account? " : "New here? "}
          <button
            type="button"
            onClick={() => {
              setMode(isSignup ? "login" : "signup");
              setError(null);
            }}
          >
            {isSignup ? "Log in" : "Create one"}
          </button>
        </div>
      </div>
    </div>
  );
}
