-- AlterTable
ALTER TABLE "users" ADD COLUMN     "xp_total" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "earned_achievements" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "earned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "earned_achievements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "earned_achievements_user_id_key_key" ON "earned_achievements"("user_id", "key");

-- AddForeignKey
ALTER TABLE "earned_achievements" ADD CONSTRAINT "earned_achievements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
