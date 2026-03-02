/*
  Warnings:

  - You are about to drop the column `player_a_id` on the `match` table. All the data in the column will be lost.
  - You are about to drop the column `player_a_name` on the `match` table. All the data in the column will be lost.
  - You are about to drop the column `player_b_id` on the `match` table. All the data in the column will be lost.
  - You are about to drop the column `player_b_name` on the `match` table. All the data in the column will be lost.
  - You are about to drop the column `team_a_id` on the `match` table. All the data in the column will be lost.
  - You are about to drop the column `team_b_id` on the `match` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "MatchSide" AS ENUM ('a', 'b');

-- DropForeignKey
ALTER TABLE "match" DROP CONSTRAINT "match_player_a_id_fkey";

-- DropForeignKey
ALTER TABLE "match" DROP CONSTRAINT "match_player_b_id_fkey";

-- DropForeignKey
ALTER TABLE "match" DROP CONSTRAINT "match_team_a_id_fkey";

-- DropForeignKey
ALTER TABLE "match" DROP CONSTRAINT "match_team_b_id_fkey";

-- AlterTable
ALTER TABLE "match" DROP COLUMN "player_a_id",
DROP COLUMN "player_a_name",
DROP COLUMN "player_b_id",
DROP COLUMN "player_b_name",
DROP COLUMN "team_a_id",
DROP COLUMN "team_b_id";

-- CreateTable
CREATE TABLE "match_participant" (
    "id" SERIAL NOT NULL,
    "match_id" INTEGER NOT NULL,
    "side" "MatchSide" NOT NULL,
    "user_id" INTEGER,
    "team_id" INTEGER,
    "team_name" VARCHAR(100),
    "display_name" VARCHAR(100) NOT NULL,

    CONSTRAINT "match_participant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "match_participant_match_id_side_idx" ON "match_participant"("match_id", "side");

-- AddForeignKey
ALTER TABLE "match_participant" ADD CONSTRAINT "match_participant_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "match"("match_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_participant" ADD CONSTRAINT "match_participant_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_participant" ADD CONSTRAINT "match_participant_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "team"("team_id") ON DELETE SET NULL ON UPDATE CASCADE;
