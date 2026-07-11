# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Deployment workflow — push straight to `main`

**This repo auto-deploys: pushing to `main` triggers a Coolify rebuild + redeploy.**

- Commit changes and **push directly to `main`**. No feature branch, no pull
  request, no review gate is required for routine work — just
  `git push origin main`.
- Keep commits focused and use clear messages; `main` history _is_ the
  deploy log.
- Only branch off if the user explicitly asks for a PR or wants to stage
  something without deploying it.
- After pushing, the user redeploys via Coolify (or it auto-builds from the
  new `main`). On boot the container runs migrations + seed automatically.

## What this is

**JabberYap** — a full-stack spaced-repetition language-learning app (SM-2),
deployed as a **single Docker container** on Coolify. The Express backend
serves both the REST API and the built React frontend on one port. Currently
teaches Danish, with multi-language support in progress (see the plan at
the time of writing for the target/native text generalization).

## Architecture

- `server/` — Node.js + Express REST API (ESM). Prisma + PostgreSQL.
  - `src/index.js` — entry: API routes, static frontend, `/health`.
  - `src/routes/` — `auth`, `decks`, `cards`, `study`, `dashboard`.
  - `src/utils/sm2.js` — SM-2 algorithm (Again/Hard/Good/Easy).
  - `prisma/schema.prisma` — `users`, `decks`, `cards`,
    `user_card_progress`, `daily_activity`.
  - `prisma/seedData.js` + `seed.js` — idempotent built-in content seeder.
- `client/` — React + Vite SPA. Built to static files served by the backend.
  - `src/pages/` — `Login`, `Dashboard`, `Study`, `Browse`.
  - `src/answerCheck.js` — type-answer grading + hint helpers.
- `Dockerfile` — multi-stage (build frontend → backend serves both).
- `docker-entrypoint.sh` — on boot: `prisma migrate deploy` → seed → start.

## Local development

```bash
# Full stack (app + Postgres) via Docker:
cp .env.example .env
docker compose up --build          # http://localhost:8080

# Or run pieces directly:
cd server && npm install && npm run dev     # API on :8080 (needs DATABASE_URL, JWT_SECRET)
cd client && npm install && npm run dev     # Vite on :5173, proxies /api -> :8080
```

Auth is email + password (bcrypt) with a JWT kept in `localStorage` and sent
as a `Bearer` token.

## Conventions & gotchas

- **One deployable container.** Keep API + frontend served together on the
  single `PORT` (default 8080). Don't split them into separate services.
- **Prisma on Docker:** the runtime image is Debian-slim (glibc) with
  `openssl` installed, and `schema.prisma` pins
  `binaryTargets = ["native", "debian-openssl-3.0.x"]`. Do **not** switch the
  Docker base to Alpine — the Prisma schema engine fails to load libssl there.
- **Seeding is idempotent** (matches by deck name + card Danish text), so new
  built-in content added to `seedData.js` is picked up on the next deploy
  without duplicating existing cards.
- **Schema extensions beyond the original spec:** `cards`/`decks` have a
  nullable `owner_id` (null = built-in, set = a user's custom content), and
  `daily_activity` backs the streak counter.
- After changing `client/` code, no manual build is needed for deploy — the
  Dockerfile builds the frontend. For local non-Docker testing, run
  `npm run build` in `client/` so the backend can serve `client/dist`.

## Verifying changes

There's no formal test suite. To verify UI/flow changes, build the client and
drive the running app (the app was validated this way with Playwright browser
runs against a local Postgres). Prefer exercising the real flow over assuming.
