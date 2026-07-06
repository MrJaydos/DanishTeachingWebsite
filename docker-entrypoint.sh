#!/bin/sh
# Container startup: bring the database schema up to date, seed the built-in
# decks/cards (idempotent), then launch the server. Runs on every deploy.
set -e

cd /app/server

echo "==> Applying database migrations..."
npx prisma migrate deploy

echo "==> Seeding built-in content..."
node prisma/seed.js

echo "==> Starting server..."
exec node src/index.js
