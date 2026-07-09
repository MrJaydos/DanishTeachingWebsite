import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useSettings } from "../context/SettingsContext.jsx";

export default function Layout() {
  const { logout } = useAuth();
  const { theme, muted, toggleTheme, toggleMuted } = useSettings();
  const [menuOpen, setMenuOpen] = useState(false);

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <span className="brand">
            <span className="dot" />
            Dansk
          </span>

          <button
            className="menu-toggle"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
          >
            {menuOpen ? "✕" : "☰"}
          </button>

          <nav className={`nav ${menuOpen ? "open" : ""}`}>
            <NavLink to="/" end onClick={closeMenu}>
              Dashboard
            </NavLink>
            <NavLink to="/study" onClick={closeMenu}>
              Study
            </NavLink>
            <NavLink to="/browse" onClick={closeMenu}>
              Browse
            </NavLink>
            <NavLink to="/achievements" onClick={closeMenu}>
              🏆 Achievements
            </NavLink>
            <NavLink to="/settings" onClick={closeMenu}>
              Settings
            </NavLink>
            <div className="nav-toggles">
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
            </div>
            <button
              className="signout"
              onClick={() => {
                closeMenu();
                logout();
              }}
            >
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
