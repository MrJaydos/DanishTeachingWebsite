import { createContext, useContext, useEffect, useState } from "react";
import { setMuted as setTtsMuted } from "../tts.js";
import { getStudyLanguage, persistStudyLanguage } from "../studyLanguage.js";

const SettingsContext = createContext(null);

const THEME_KEY = "danish_theme";
const MUTE_KEY = "danish_muted";
const META_COLOR = { light: "#f7f5f0", dark: "#171614" };

export function SettingsProvider({ children }) {
  // Initial theme is set on <html> by an inline script in index.html (no flash);
  // read it back here as the source of truth.
  const [theme, setTheme] = useState(() =>
    document.documentElement.dataset.theme === "dark" ? "dark" : "light"
  );
  const [muted, setMutedState] = useState(
    () => localStorage.getItem(MUTE_KEY) === "1"
  );
  const [studyLanguage, setStudyLanguageState] = useState(getStudyLanguage);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", META_COLOR[theme]);
  }, [theme]);

  useEffect(() => {
    setTtsMuted(muted);
    localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  }, [muted]);

  useEffect(() => {
    persistStudyLanguage(studyLanguage);
  }, [studyLanguage]);

  const value = {
    theme,
    muted,
    studyLanguage,
    toggleTheme: () => setTheme((t) => (t === "dark" ? "light" : "dark")),
    toggleMuted: () => setMutedState((m) => !m),
    setStudyLanguage: setStudyLanguageState,
  };

  return (
    <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
