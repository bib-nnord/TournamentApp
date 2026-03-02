-- CreateEnum
CREATE TYPE "ParticipantType" AS ENUM ('account', 'guest', 'team');

-- AlterTable
ALTER TABLE "tournament_participant" ADD COLUMN     "members_snapshot" JSONB,
ADD COLUMN     "participant_type" "ParticipantType" NOT NULL DEFAULT 'guest',
ADD COLUMN     "team_id" INTEGER;

-- AddForeignKey
ALTER TABLE "tournament_participant" ADD CONSTRAINT "tournament_participant_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "team"("team_id") ON DELETE SET NULL ON UPDATE CASCADE;
