-- AlterTable
ALTER TABLE "tournament" ADD COLUMN     "team_assignments" JSONB,
ADD COLUMN     "team_mode" BOOLEAN NOT NULL DEFAULT false;
