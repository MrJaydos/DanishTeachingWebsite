// Idempotent seeder for built-in decks and cards.
//
// Runs on every container start (see docker-entrypoint.sh). It only inserts
// decks/cards that don't already exist, so it's safe to run repeatedly and new
// content added to seedData.js will be picked up on the next deploy.

import { PrismaClient } from "@prisma/client";
import { DECKS } from "./seedData.js";

const prisma = new PrismaClient();

async function main() {
  let createdDecks = 0;
  let createdCards = 0;

  for (const deckDef of DECKS) {
    // System decks are identified by (name, category, language, ownerId=null)
    // — the language is part of the identity so e.g. a future Spanish "Food &
    // Drink" deck doesn't collide with the existing Danish one.
    let deck = await prisma.deck.findFirst({
      where: {
        name: deckDef.name,
        category: deckDef.category,
        language: deckDef.language,
        ownerId: null,
      },
    });

    if (!deck) {
      deck = await prisma.deck.create({
        data: {
          name: deckDef.name,
          category: deckDef.category,
          language: deckDef.language,
          description: deckDef.description || null,
          ownerId: null,
        },
      });
      createdDecks += 1;
    }

    for (const card of deckDef.cards) {
      const exists = await prisma.card.findFirst({
        where: {
          deckId: deck.id,
          targetText: card.targetText,
          ownerId: null,
        },
        select: { id: true },
      });
      if (!exists) {
        await prisma.card.create({
          data: {
            deckId: deck.id,
            targetText: card.targetText,
            nativeText: card.nativeText,
            exampleSentence: card.exampleSentence || null,
            cardType: deckDef.category,
            ownerId: null,
          },
        });
        createdCards += 1;
      }
    }
  }

  const totalCards = await prisma.card.count({ where: { ownerId: null } });
  console.log(
    `Seed complete. Added ${createdDecks} deck(s) and ${createdCards} card(s). ` +
      `Total built-in cards: ${totalCards}.`
  );
}

main()
  .catch((e) => {
    console.error("Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
