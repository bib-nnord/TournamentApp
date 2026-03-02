-- AlterTable
ALTER TABLE "match" ADD COLUMN     "team_a_id" INTEGER,
ADD COLUMN     "team_b_id" INTEGER;

-- AddForeignKey
ALTER TABLE "match" ADD CONSTRAINT "match_team_a_id_fkey" FOREIGN KEY ("team_a_id") REFERENCES "team"("team_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match" ADD CONSTRAINT "match_team_b_id_fkey" FOREIGN KEY ("team_b_id") REFERENCES "team"("team_id") ON DELETE SET NULL ON UPDATE CASCADE;
