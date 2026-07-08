import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";

export default function Settings() {
  const { user, deleteAccount } = useAuth();

  return (
    <div>
      <p className="section-title">Account</p>
      <h1>Settings</h1>

      <div className="card" style={{ padding: 24, marginTop: 20, marginBottom: 24 }}>
        <p className="section-title" style={{ marginBottom: 4 }}>
          Signed in as
        </p>
        <p>{user?.email}</p>
        {user?.createdAt && (
          <p className="muted" style={{ fontSize: "0.85rem", marginTop: 4 }}>
            Member since {new Date(user.createdAt).toLocaleDateString()}
          </p>
        )}
      </div>

      <ChangePasswordCard />
      <DangerZoneCard deleteAccount={deleteAccount} />
    </div>
  );
}

function ChangePasswordCard() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState(null);
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError(null);
    setOk(false);
    if (newPassword !== confirm) {
      setError("New passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      setOk(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirm("");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card" style={{ padding: 24, marginBottom: 24 }}>
      <p className="section-title" style={{ marginBottom: 12 }}>
        Change password
      </p>
      {error && <div className="alert error">{error}</div>}
      {ok && <div className="alert" style={{ marginBottom: 16 }}>Password updated.</div>}
      <form onSubmit={submit}>
        <div className="field">
          <label>Current password</label>
          <input
            className="input"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label>New password</label>
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            minLength={8}
            required
          />
        </div>
        <div className="field">
          <label>Confirm new password</label>
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            minLength={8}
            required
          />
        </div>
        <button className="btn primary" disabled={busy}>
          {busy ? "Saving…" : "Update password"}
        </button>
      </form>
    </div>
  );
}

function DangerZoneCard({ deleteAccount }) {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError(null);
    if (
      !confirm(
        "This permanently deletes your account and all your custom decks, cards, and progress. This can't be undone. Continue?"
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      await deleteAccount(password);
      navigate("/login", { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="card danger-zone" style={{ padding: 24 }}>
      <p className="section-title" style={{ marginBottom: 4 }}>
        Danger zone
      </p>
      <p className="muted" style={{ marginBottom: 16 }}>
        Permanently delete your account and all associated data.
      </p>
      {error && <div className="alert error">{error}</div>}
      <form onSubmit={submit} className="row" style={{ alignItems: "flex-end" }}>
        <div className="field" style={{ flex: 1, marginBottom: 0 }}>
          <label>Confirm your password</label>
          <input
            className="input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button className="btn danger" disabled={busy}>
          {busy ? "Deleting…" : "Delete account"}
        </button>
      </form>
    </div>
  );
}
