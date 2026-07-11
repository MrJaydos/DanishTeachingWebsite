import { Router } from "express";
import { prisma } from "../prisma.js";
import { requireAuth } from "../middleware/auth.js";

export const decksRouter = Router();
decksRouter.use(requireAuth);

const CATEGORIES = ["vocab", "grammar", "listening"];

// List all decks visible to this user (built-in decks + their own custom decks),
// each with a card count and how many cards are currently due for this user.
decksRouter.get("/", async (req, res) => {
  const userId = req.user.id;
  const language = req.query.language ? String(req.query.language) : undefined;
  const decks = await prisma.deck.findMany({
    where: {
      OR: [{ ownerId: null }, { ownerId: userId }],
      ...(language ? { language } : {}),
    },
    orderBy: [{ ownerId: "asc" }, { category: "asc" }, { name: "asc" }],
    include: { _count: { select: { cards: true } } },
  });

  // Count due cards per deck for this user in a single grouped query.
  const now = new Date();
  const dueRows = await prisma.$queryRaw`
    SELECT c.deck_id AS "deckId", COUNT(*)::int AS "due"
    FROM cards c
    JOIN user_card_progress p ON p.card_id = c.id
    WHERE p.user_id = ${userId} AND p.due_date <= ${now}
    GROUP BY c.deck_id
  `;
  const dueByDeck = Object.fromEntries(dueRows.map((r) => [r.deckId, r.due]));

  res.json({
    decks: decks.map((d) => ({
      id: d.id,
      name: d.name,
      category: d.category,
      description: d.description,
      language: d.language,
      isCustom: d.ownerId !== null,
      cardCount: d._count.cards,
      dueCount: dueByDeck[d.id] || 0,
    })),
  });
});

// Create a custom deck owned by the current user.
decksRouter.post("/", async (req, res) => {
  const name = String(req.body.name || "").trim();
  const category = String(req.body.category || "vocab").trim();
  const description = req.body.description ? String(req.body.description).trim() : null;
  const language = String(req.body.language || "da").trim();

  if (!name) return res.status(400).json({ error: "Deck name is required." });
  if (!CATEGORIES.includes(category)) {
    return res.status(400).json({ error: `Category must be one of: ${CATEGORIES.join(", ")}` });
  }

  const deck = await prisma.deck.create({
    data: { name, category, description, language, ownerId: req.user.id },
  });
  res.status(201).json({ deck });
});

// Edit a custom deck's name/description owned by the current user. Category
// is immutable — it drives cardType for cards created in this deck, so
// changing it after the fact would leave existing cards inconsistent.
decksRouter.patch("/:id", async (req, res) => {
  const deck = await prisma.deck.findUnique({ where: { id: req.params.id } });
  if (!deck || deck.ownerId !== req.user.id) {
    return res.status(404).json({ error: "Deck not found." });
  }

  const name = String(req.body.name ?? deck.name).trim();
  const description =
    req.body.description !== undefined
      ? String(req.body.description).trim() || null
      : deck.description;

  if (!name) return res.status(400).json({ error: "Deck name is required." });

  const updated = await prisma.deck.update({
    where: { id: deck.id },
    data: { name, description },
  });
  res.json({ deck: updated });
});

// Delete a custom deck (and its cards) owned by the current user.
decksRouter.delete("/:id", async (req, res) => {
  const deck = await prisma.deck.findUnique({ where: { id: req.params.id } });
  if (!deck || deck.ownerId !== req.user.id) {
    return res.status(404).json({ error: "Deck not found." });
  }
  await prisma.deck.delete({ where: { id: deck.id } });
  res.json({ ok: true });
});
