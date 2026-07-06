# ---------------------------------------------------------------------------
# Multi-stage build:
#   1) build the React frontend (Vite) -> static files
#   2) install backend deps + generate the Prisma client
#   3) assemble a small runtime image that serves BOTH the API and the frontend
#      on a single port.
# This image is what Coolify builds and runs directly from the repo.
# ---------------------------------------------------------------------------

# ---- Stage 1: build the frontend ------------------------------------------
FROM node:22-alpine AS client-build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# ---- Stage 2: install backend deps + generate Prisma client ---------------
FROM node:22-alpine AS server-build
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci
COPY server/ ./
RUN npx prisma generate

# ---- Stage 3: runtime ------------------------------------------------------
FROM node:22-alpine AS runner
ENV NODE_ENV=production
WORKDIR /app

# Backend (incl. node_modules with the generated Prisma client) and the
# built frontend that the backend serves as static files.
COPY --from=server-build /app/server ./server
COPY --from=client-build /app/client/dist ./client/dist
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

# The app reads PORT from the environment (default 8080). Coolify maps this.
EXPOSE 8080

# On start: apply DB migrations, seed built-in content, then run the server.
CMD ["./docker-entrypoint.sh"]
