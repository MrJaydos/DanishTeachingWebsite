// Thin fetch wrapper. The JWT is kept in localStorage and sent as a Bearer
// token. On the web (dev + the Coolify PWA deploy), requests are same-origin
// (/api/...) — proxied to the backend in dev by Vite, served by the backend
// itself in production. Inside the Capacitor native app, the built assets are
// bundled locally with no same-origin backend to call, so requests there need
// an absolute URL to wherever this app is actually deployed (baked in at
// build time via VITE_API_BASE_URL — see client/.env.capacitor.example and
// the "build:capacitor" script).
import { Capacitor } from "@capacitor/core";

export const API_BASE = Capacitor.isNativePlatform() ? import.meta.env.VITE_API_BASE_URL || "" : "";

const TOKEN_KEY = "danish_token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request(method, path, body) {
  const headers = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  get: (p) => request("GET", p),
  post: (p, b) => request("POST", p, b),
  del: (p) => request("DELETE", p),

  // Auth
  signup: (email, password) => request("POST", "/auth/signup", { email, password }),
  login: (email, password) => request("POST", "/auth/login", { email, password }),
  me: () => request("GET", "/auth/me"),
  forgotPassword: (email) => request("POST", "/auth/forgot-password", { email }),
  resetPassword: (token, password) =>
    request("POST", "/auth/reset-password", { token, password }),
  changePassword: (currentPassword, newPassword) =>
    request("POST", "/auth/change-password", { currentPassword, newPassword }),
  deleteAccount: (password) => request("DELETE", "/auth/account", { password }),

  // Content
  decks: () => request("GET", "/decks"),
  createDeck: (d) => request("POST", "/decks", d),
  updateDeck: (id, d) => request("PATCH", `/decks/${id}`, d),
  deleteDeck: (id) => request("DELETE", `/decks/${id}`),
  cards: (deckId) => request("GET", `/cards${deckId ? `?deckId=${deckId}` : ""}`),
  createCard: (c) => request("POST", "/cards", c),
  updateCard: (id, c) => request("PATCH", `/cards/${id}`, c),
  deleteCard: (id) => request("DELETE", `/cards/${id}`),

  // Study
  session: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request("GET", `/study/session${q ? `?${q}` : ""}`);
  },
  review: (cardId, rating) => request("POST", "/study/review", { cardId, rating }),
  undoReview: (cardId, previous, xpEarned) =>
    request("POST", "/study/review/undo", { cardId, previous, xpEarned }),

  // Dashboard
  dashboard: () => request("GET", "/dashboard"),

  // Achievements
  achievements: () => request("GET", "/achievements"),
};
