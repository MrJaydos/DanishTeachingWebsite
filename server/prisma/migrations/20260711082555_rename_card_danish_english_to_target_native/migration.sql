-- Hand-authored: rename, not drop+recreate. Prisma's migration diffing does
-- not detect field renames, so the auto-generated version of this migration
-- would have dropped danish_text/english_text and added new empty columns,
-- discarding every existing card's text. RENAME COLUMN preserves the data.
ALTER TABLE "cards" RENAME COLUMN "danish_text" TO "target_text";
ALTER TABLE "cards" RENAME COLUMN "english_text" TO "native_text";
