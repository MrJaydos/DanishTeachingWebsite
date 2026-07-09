import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

import { config, isProd } from "./config.js";
import { prisma } from "./prisma.js";
import { authRouter } from "./routes/auth.js";
import { decksRouter } from "./routes/decks.js";
import { cardsRouter } from "./routes/cards.js";
import { studyRouter } from "./routes/study.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { achievementsRouter } from "./routes/achievements.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Built React app lives at <repo>/client/dist (see Dockerfile).
const clientDist = path.resolve(__dirname, "../../client/dist");

const app = express();
app.use(express.json({ limit: "1mb" }));

// In dev the Vite server runs on a different port and proxies /api, but CORS
// keeps direct API calls working too.
if (!isProd) app.use(cors());

// --- Health check (used by Docker / Coolify) --------------------------------
app.get("/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", db: "up" });
  } catch {
    res.status(503).json({ status: "degraded", db: "down" });
  }
});

// --- API routes -------------------------------------------------------------
app.use("/api/auth", authRouter);
app.use("/api/decks", decksRouter);
app.use("/api/cards", cardsRouter);
app.use("/api/study", studyRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/achievements", achievementsRouter);

app.use("/api", (_req, res) => res.status(404).json({ error: "Not found" }));

// --- Static frontend + SPA fallback -----------------------------------------
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
} else {
  app.get("/", (_req, res) => {
    res
      .status(200)
      .send(
        "API is running. The React frontend has not been built. " +
          "Run `npm run build` in /client (or use the Docker image)."
      );
  });
}

// --- Error handler ----------------------------------------------------------
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

const server = app.listen(config.port, () => {
  console.log(`Danish learning app listening on port ${config.port}`);
});

// Graceful shutdown so Coolify/Docker can stop the container cleanly.
const shutdown = async () => {
  console.log("Shutting down...");
  server.close();
  await prisma.$disconnect();
  process.exit(0);
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
