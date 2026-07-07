// Thin fetch wrapper. The JWT is kept in localStorage and sent as a Bearer
// token. All requests are same-origin (/api/...), proxied to the backend in
// dev by Vite and served by the backend itself in production.

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

  const res = await fetch(`/api${path}`, {
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

  // Content
  decks: () => request("GET", "/decks"),
  createDeck: (d) => request("POST", "/decks", d),
  deleteDeck: (id) => request("DELETE", `/decks/${id}`),
  cards: (deckId) => request("GET", `/cards${deckId ? `?deckId=${deckId}` : ""}`),
  createCard: (c) => request("POST", "/cards", c),
  deleteCard: (id) => request("DELETE", `/cards/${id}`),

  // Study
  session: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request("GET", `/study/session${q ? `?${q}` : ""}`);
  },
  review: (cardId, rating) => request("POST", "/study/review", { cardId, rating }),

  // Dashboard
  dashboard: () => request("GET", "/dashboard"),
};
