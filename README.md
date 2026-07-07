# 🇩🇰 Dansk — Learn Danish

A full-stack spaced-repetition web app for English speakers progressing from
Danish basics toward intermediate level. User accounts keep your progress tied
to _you_, not a browser, and the whole thing ships as **one Docker container**
that's ready to deploy on [Coolify](https://coolify.io) straight from GitHub.

- **Spaced repetition** with the classic **SM-2** algorithm (Again / Hard / Good / Easy), per-user, per-card.
- **~136 built-in cards** across vocab (food, travel, work, home, time), grammar (word order, verb conjugation, en/et articles, plurals) and listening phrases.
- **Danish audio** on every card via the browser's `SpeechSynthesis` API — no audio files stored.
- **Dashboard** with cards due today, cards learned, and a daily **streak**.
- **Add your own** custom decks and cards.
- Clean, minimal, Scandinavian-inspired UI.

---

## Tech stack

| Layer     | Choice                                            |
| --------- | ------------------------------------------------- |
| Backend   | Node.js + Express (REST API)                      |
| Database  | PostgreSQL + Prisma ORM (schema & migrations)     |
| Frontend  | React + Vite (built to static files)              |
| Auth      | Email + password, bcrypt hashing, JWT sessions    |
| Packaging | Single multi-stage Docker image (API + frontend)  |

The backend serves the built React app **and** the API on a single port, so
there's only one container to deploy.

---

## Project structure

```
.
├── Dockerfile              # multi-stage: build frontend, run backend serving both
├── docker-compose.yml      # local dev: app + Postgres
├── docker-entrypoint.sh    # migrate + seed + start (runs on every container boot)
├── .env.example            # all required env vars
├── client/                 # React + Vite frontend
│   └── src/{pages,components,context}
└── server/                 # Express API
    ├── prisma/
    │   ├── schema.prisma    # users, decks, cards, user_card_progress, daily_activity
    │   ├── migrations/      # committed SQL migrations
    │   ├── seedData.js      # built-in Danish content
    │   └── seed.js          # idempotent seeder
    └── src/
        ├── index.js         # app entry (API + static + /health)
        ├── routes/          # auth, decks, cards, study, dashboard
        ├── middleware/auth.js
        └── utils/sm2.js     # the SM-2 algorithm
```

---

## Running locally with Docker Compose (recommended)

This spins up the app **and** a Postgres database together.

```bash
cp .env.example .env      # tweak JWT_SECRET if you like
docker compose up --build
```

Then open **http://localhost:8080**, create an account, and start studying.

On startup the container automatically:

1. applies database migrations (`prisma migrate deploy`),
2. seeds the built-in decks/cards (idempotent — safe to re-run), and
3. starts the server.

To stop: `docker compose down` (add `-v` to also wipe the database volume).

---

## Running locally without Docker

You'll need Node 20+ and a running PostgreSQL.

```bash
# 1) Backend
cd server
npm install
export DATABASE_URL="postgresql://USER:PASS@localhost:5432/danish?schema=public"
export JWT_SECRET="dev-secret"
npx prisma migrate deploy      # or: npx prisma migrate dev
npm run seed
npm run dev                    # API on http://localhost:8080

# 2) Frontend (separate terminal)
cd client
npm install
npm run dev                    # Vite on http://localhost:5173, proxies /api -> :8080
```

In dev, use **http://localhost:5173** (Vite proxies API calls to the backend).
In production the backend serves the built frontend directly on `PORT`.

---

## Environment variables

See [`.env.example`](./.env.example). The ones the **app** needs:

| Variable         | Required | Description                                         |
| ---------------- | :------: | --------------------------------------------------- |
| `PORT`           |    –     | Port the app listens on. Default `8080`.            |
| `DATABASE_URL`   |   ✅     | PostgreSQL connection string.                       |
| `JWT_SECRET`     |   ✅     | Long random string used to sign session tokens.     |
| `JWT_EXPIRES_IN` |    –     | Session lifetime. Default `7d`.                     |
| `NODE_ENV`       |    –     | `production` when deployed.                         |

Generate a good secret with: `openssl rand -base64 48`

---

## Deploying on Coolify (from GitHub)

The repo is structured so Coolify can build the `Dockerfile` with **zero extra
config** beyond setting environment variables.

1. **Create a PostgreSQL database** in Coolify (Resources → Databases → PostgreSQL).
   Copy its connection string.
2. **Create a new Application** in Coolify and point it at this GitHub repo.
   - Build Pack: **Dockerfile** (Coolify auto-detects the `Dockerfile` at the repo root).
   - Coolify watches the repo and rebuilds on push.
3. **Set environment variables** in the app's _Environment Variables_ tab:
   - `DATABASE_URL` → the Postgres connection string from step 1
     _(if the DB is inside Coolify, use its internal hostname)._
   - `JWT_SECRET` → a long random string (`openssl rand -base64 48`).
   - `PORT` → `8080` (or your choice; Coolify maps this port).
   - `NODE_ENV` → `production`.
4. **Set the port**: make sure Coolify's _Ports Exposes_ matches `PORT` (e.g. `8080`).
5. **Health check**: point Coolify's health check at **`GET /health`**
   (the app returns `200 {"status":"ok"}` when healthy, `503` if the DB is down).
6. **Deploy.** On boot the container migrates the schema and seeds the built-in
   content automatically — no manual DB step needed.

That's it — Coolify builds the image, runs the single container, and the app is
live. Every subsequent `git push` triggers a rebuild; migrations and seeding
run again automatically and idempotently.

---

## How the spaced repetition works

Each review updates the card's SM-2 state (`ease_factor`, `interval_days`,
`repetitions`, `due_date`) stored **per user, per card** in `user_card_progress`:

- **Again** — lapse: the card resets and becomes due again in the same session.
- **Hard** — advances, but with a reduced interval and a lower ease factor.
- **Good** — the standard SM-2 progression (1 day → 6 days → interval × ease).
- **Easy** — advances fastest and nudges the ease factor up.

A study session serves cards that are **due** plus a capped number of **new**
cards you haven't seen yet. Every review is logged in `daily_activity`, which
powers the streak counter on the dashboard.

The algorithm lives in [`server/src/utils/sm2.js`](./server/src/utils/sm2.js).

---

## API overview

All routes are under `/api`. Protected routes require an
`Authorization: Bearer <token>` header.

| Method | Route                  | Description                          |
| ------ | ---------------------- | ------------------------------------ |
| POST   | `/api/auth/signup`     | Create account, returns JWT          |
| POST   | `/api/auth/login`      | Log in, returns JWT                  |
| POST   | `/api/auth/logout`     | Client discards token                |
| GET    | `/api/auth/me`         | Current user                         |
| GET    | `/api/dashboard`       | Due count, learned, streak, activity |
| GET    | `/api/study/session`   | Cards due + new for a study session  |
| POST   | `/api/study/review`    | Submit a rating, updates SM-2 state  |
| GET    | `/api/decks`           | List decks (built-in + your own)     |
| POST   | `/api/decks`           | Create a custom deck                 |
| DELETE | `/api/decks/:id`       | Delete your custom deck              |
| GET    | `/api/cards?deckId=`   | List cards (with your progress)      |
| POST   | `/api/cards`           | Add a custom card                    |
| DELETE | `/api/cards/:id`       | Delete your custom card              |
| GET    | `/health`              | Health check (used by Docker/Coolify)|
