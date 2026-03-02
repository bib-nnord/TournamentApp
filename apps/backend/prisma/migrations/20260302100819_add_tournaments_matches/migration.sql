-- CreateEnum
CREATE TYPE "TournamentFormat" AS ENUM ('single_elimination', 'double_elimination', 'round_robin', 'double_round_robin', 'combination', 'swiss');

-- CreateEnum
CREATE TYPE "TournamentStatus" AS ENUM ('draft', 'registration', 'active', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('scheduled', 'in_progress', 'completed', 'tie', 'cancelled');

-- CreateTable
CREATE TABLE "tournament" (
    "tournament_id" SERIAL NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "game" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "format" "TournamentFormat" NOT NULL,
    "status" "TournamentStatus" NOT NULL DEFAULT 'draft',
    "is_private" BOOLEAN NOT NULL DEFAULT false,
    "max_participants" INTEGER,
    "bracket_data" JSONB,
    "created_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "tournament_pkey" PRIMARY KEY ("tournament_id")
);

-- CreateTable
CREATE TABLE "tournament_participant" (
    "tournament_id" INTEGER NOT NULL,
    "seed" INTEGER NOT NULL,
    "user_id" INTEGER,
    "guest_name" VARCHAR(100),
    "display_name" VARCHAR(100) NOT NULL,
    "joined_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tournament_participant_pkey" PRIMARY KEY ("tournament_id","seed")
);

-- CreateTable
CREATE TABLE "match" (
    "match_id" SERIAL NOT NULL,
    "tournament_id" INTEGER,
    "round" VARCHAR(100),
    "position" INTEGER,
    "status" "MatchStatus" NOT NULL DEFAULT 'scheduled',
    "player_a_id" INTEGER,
    "player_b_id" INTEGER,
    "player_a_name" VARCHAR(100),
    "player_b_name" VARCHAR(100),
    "score_a" INTEGER,
    "score_b" INTEGER,
    "scheduled_at" TIMESTAMP(6),
    "played_at" TIMESTAMP(6),
    "notes" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "match_pkey" PRIMARY KEY ("match_id")
);

-- AddForeignKey
ALTER TABLE "tournament" ADD CONSTRAINT "tournament_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "user"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_participant" ADD CONSTRAINT "tournament_participant_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournament"("tournament_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_participant" ADD CONSTRAINT "tournament_participant_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match" ADD CONSTRAINT "match_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournament"("tournament_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match" ADD CONSTRAINT "match_player_a_id_fkey" FOREIGN KEY ("player_a_id") REFERENCES "user"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match" ADD CONSTRAINT "match_player_b_id_fkey" FOREIGN KEY ("player_b_id") REFERENCES "user"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;
