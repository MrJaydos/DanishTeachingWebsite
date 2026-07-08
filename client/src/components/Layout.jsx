import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useSettings } from "../context/SettingsContext.jsx";

export default function Layout() {
  const { logout } = useAuth();
  const { theme, muted, toggleTheme, toggleMuted } = useSettings();

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <span className="brand">
            <span className="dot" />
            Dansk
          </span>
          <nav className="nav">
            <NavLink to="/" end>
              Dashboard
            </NavLink>
            <NavLink to="/study">Study</NavLink>
            <NavLink to="/browse">Browse</NavLink>
            <NavLink to="/settings">Settings</NavLink>
            <button
              className="icon-toggle"
              onClick={toggleMuted}
              title={muted ? "Unmute audio" : "Mute audio (quiet mode)"}
              aria-label={muted ? "Unmute audio" : "Mute audio"}
            >
              {muted ? "🔇" : "🔊"}
            </button>
            <button
              className="icon-toggle"
              onClick={toggleTheme}
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              aria-label="Toggle dark mode"
            >
              {theme === "dark" ? "☀️" : "🌙"}
            </button>
            <button className="signout" onClick={logout}>
              Sign out
            </button>
          </nav>
        </div>
      </header>
      <main className="container">
        <Outlet />
      </main>
    </div>
  );
}
