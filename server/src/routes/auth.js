import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import rateLimit from "express-rate-limit";
import { prisma } from "../prisma.js";
import { requireAuth, signToken } from "../middleware/auth.js";
import { config } from "../config.js";
import { sendPasswordResetEmail } from "../utils/mailer.js";

export const authRouter = Router();

// Basic protection against brute-force / signup spam.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts, please try again later." },
});

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateCredentials(email, password) {
  if (!email || !EMAIL_RE.test(email)) return "A valid email is required.";
  if (!password || password.length < 8)
    return "Password must be at least 8 characters.";
  return null;
}

authRouter.post("/signup", authLimiter, async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");

  const err = validateCredentials(email, password);
  if (err) return res.status(400).json({ error: err });

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ error: "An account with that email already exists." });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { email, passwordHash },
    select: { id: true, email: true, createdAt: true },
  });

  const token = signToken(user);
  return res.status(201).json({ token, user });
});

authRouter.post("/login", authLimiter, async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  // Compare even when the user is missing to avoid leaking which emails exist.
  const hash = user?.passwordHash || "$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv";
  const ok = await bcrypt.compare(password, hash);

  if (!user || !ok) {
    return res.status(401).json({ error: "Invalid email or password." });
  }

  const token = signToken(user);
  return res.json({
    token,
    user: { id: user.id, email: user.email, createdAt: user.createdAt },
  });
});

// With stateless JWTs, logout is handled client-side by discarding the token.
// This endpoint exists so the frontend has a symmetric call to make.
authRouter.post("/logout", (_req, res) => {
  res.json({ ok: true });
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { id: true, email: true, createdAt: true },
  });
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ user });
});

// Request a password reset link. Always responds the same way regardless of
// whether the email exists, so this endpoint can't be used to enumerate
// accounts.
authRouter.post("/forgot-password", authLimiter, async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const genericResponse = {
    ok: true,
    message: "If an account exists for that email, a reset link has been sent.",
  };

  if (!email || !EMAIL_RE.test(email)) return res.json(genericResponse);

  const user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    const token = crypto.randomBytes(32).toString("hex");
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      },
    });
    const resetUrl = `${config.appUrl}/reset-password?token=${token}`;
    try {
      await sendPasswordResetEmail(user.email, resetUrl);
    } catch (e) {
      console.error("Failed to send password reset email:", e);
    }
  }

  res.json(genericResponse);
});

// Complete a password reset using the token from the emailed link.
authRouter.post("/reset-password", authLimiter, async (req, res) => {
  const token = String(req.body.token || "");
  const password = String(req.body.password || "");

  if (!token) return res.status(400).json({ error: "Reset token is required." });
  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters." });
  }

  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
  });

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return res.status(400).json({ error: "This reset link is invalid or has expired." });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
  ]);

  res.json({ ok: true });
});

// Change password for the logged-in user (requires the current password).
authRouter.post("/change-password", authLimiter, requireAuth, async (req, res) => {
  const currentPassword = String(req.body.currentPassword || "");
  const newPassword = String(req.body.newPassword || "");

  if (newPassword.length < 8) {
    return res.status(400).json({ error: "New password must be at least 8 characters." });
  }

  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  const ok = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!ok) return res.status(401).json({ error: "Current password is incorrect." });

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
  res.json({ ok: true });
});

// Permanently delete the logged-in user's account and all their data
// (custom decks/cards, progress, activity — cascades via the schema).
// Requires the current password as confirmation.
authRouter.delete("/account", authLimiter, requireAuth, async (req, res) => {
  const password = String(req.body.password || "");
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: "Password is incorrect." });

  await prisma.user.delete({ where: { id: user.id } });
  res.json({ ok: true });
});
