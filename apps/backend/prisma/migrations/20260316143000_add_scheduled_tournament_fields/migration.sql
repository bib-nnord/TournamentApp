-- CreateEnum
CREATE TYPE "TournamentCreationMode" AS ENUM ('quick', 'scheduled');

-- CreateEnum
CREATE TYPE "TournamentRegistrationMode" AS ENUM ('invite_only', 'open', 'approval');

-- CreateEnum
CREATE TYPE "TournamentRegistrationStatus" AS ENUM ('invited', 'pending', 'approved', 'declined', 'withdrawn');

-- AlterTable
ALTER TABLE "tournament"
  ADD COLUMN "creation_mode" "TournamentCreationMode" NOT NULL DEFAULT 'quick',
  ADD COLUMN "registration_mode" "TournamentRegistrationMode" NOT NULL DEFAULT 'invite_only',
  ADD COLUMN "auto_start" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "registration_closes_at" TIMESTAMP(6),
  ADD COLUMN "preview_bracket_data" JSONB,
  ADD COLUMN "started_at" TIMESTAMP(6);

-- AlterTable
ALTER TABLE "tournament_participant"
  ADD COLUMN "registration_status" "TournamentRegistrationStatus" NOT NULL DEFAULT 'invited';

-- Backfill legacy participant states into new compatibility column
UPDATE "tournament_participant"
SET "registration_status" = CASE
  WHEN "participant_type" = 'guest' THEN 'approved'::"TournamentRegistrationStatus"
  WHEN "declined" = true THEN 'declined'::"TournamentRegistrationStatus"
  WHEN "confirmed" = true THEN 'approved'::"TournamentRegistrationStatus"
  ELSE 'invited'::"TournamentRegistrationStatus"
END;

-- Keep preview bracket populated for legacy quick tournaments that already have a live bracket
UPDATE "tournament"
SET "preview_bracket_data" = "bracket_data"
WHERE "creation_mode" = 'quick' AND "bracket_data" IS NOT NULL AND "preview_bracket_data" IS NULL;
