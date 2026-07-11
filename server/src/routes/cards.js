import { Router } from "express";
import { prisma } from "../prisma.js";
import { requireAuth } from "../middleware/auth.js";

export const cardsRouter = Router();
cardsRouter.use(requireAuth);

// List cards, optionally filtered by deck. Includes this user's progress state
// for each card so the Browse view can show what's learned / due.
cardsRouter.get("/", async (req, res) => {
  const userId = req.user.id;
  const deckId = req.query.deckId ? String(req.query.deckId) : undefined;

  // Only expose built-in cards and the user's own custom cards.
  const where = {
    deck: { OR: [{ ownerId: null }, { ownerId: userId }] },
    ...(deckId ? { deckId } : {}),
  };

  const cards = await prisma.card.findMany({
    where,
    orderBy: { createdAt: "asc" },
    include: {
      deck: { select: { name: true, category: true, language: true } },
      progress: { where: { userId }, take: 1 },
    },
  });

  res.json({
    cards: cards.map((c) => {
      const p = c.progress[0];
      return {
        id: c.id,
        deckId: c.deckId,
        deckName: c.deck.name,
        language: c.deck.language,
        targetText: c.targetText,
        nativeText: c.nativeText,
        exampleSentence: c.exampleSentence,
        cardType: c.cardType,
        isCustom: c.ownerId !== null,
        progress: p
          ? {
              repetitions: p.repetitions,
              intervalDays: p.intervalDays,
              easeFactor: p.easeFactor,
              dueDate: p.dueDate,
              lastReviewedAt: p.lastReviewedAt,
            }
          : null,
      };
    }),
  });
});

// Create a custom card owned by the current user. Must target one of the
// user's own decks (users can't add cards to built-in decks).
cardsRouter.post("/", async (req, res) => {
  const userId = req.user.id;
  const deckId = String(req.body.deckId || "");
  const targetText = String(req.body.targetText || "").trim();
  const nativeText = String(req.body.nativeText || "").trim();
  const exampleSentence = req.body.exampleSentence
    ? String(req.body.exampleSentence).trim()
    : null;

  if (!targetText || !nativeText) {
    return res.status(400).json({ error: "Both fields are required." });
  }

  const deck = await prisma.deck.findUnique({ where: { id: deckId } });
  if (!deck || deck.ownerId !== userId) {
    return res
      .status(400)
      .json({ error: "You can only add cards to one of your own decks." });
  }

  const card = await prisma.card.create({
    data: {
      deckId,
      targetText,
      nativeText,
      exampleSentence,
      cardType: deck.category,
      ownerId: userId,
    },
  });
  res.status(201).json({ card });
});

// Edit a custom card owned by the current user.
cardsRouter.patch("/:id", async (req, res) => {
  const card = await prisma.card.findUnique({ where: { id: req.params.id } });
  if (!card || card.ownerId !== req.user.id) {
    return res.status(404).json({ error: "Card not found." });
  }

  const targetText = String(req.body.targetText ?? card.targetText).trim();
  const nativeText = String(req.body.nativeText ?? card.nativeText).trim();
  const exampleSentence =
    req.body.exampleSentence !== undefined
      ? String(req.body.exampleSentence).trim() || null
      : card.exampleSentence;

  if (!targetText || !nativeText) {
    return res.status(400).json({ error: "Both fields are required." });
  }

  const updated = await prisma.card.update({
    where: { id: card.id },
    data: { targetText, nativeText, exampleSentence },
  });
  res.json({ card: updated });
});

// Delete a custom card owned by the current user.
cardsRouter.delete("/:id", async (req, res) => {
  const card = await prisma.card.findUnique({ where: { id: req.params.id } });
  if (!card || card.ownerId !== req.user.id) {
    return res.status(404).json({ error: "Card not found." });
  }
  await prisma.card.delete({ where: { id: card.id } });
  res.json({ ok: true });
});
