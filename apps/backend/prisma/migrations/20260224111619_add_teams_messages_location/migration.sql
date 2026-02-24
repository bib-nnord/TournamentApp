-- CreateEnum
CREATE TYPE "TeamRole" AS ENUM ('lead', 'moderator', 'member');

-- CreateEnum
CREATE TYPE "MessageCategory" AS ENUM ('users', 'teams', 'tournaments', 'website');

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "location" VARCHAR(200);

-- CreateTable
CREATE TABLE "team" (
    "team_id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "image_url" VARCHAR(500),
    "is_open" BOOLEAN NOT NULL DEFAULT false,
    "created_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_pkey" PRIMARY KEY ("team_id")
);

-- CreateTable
CREATE TABLE "team_member" (
    "team_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "role" "TeamRole" NOT NULL DEFAULT 'member',
    "joined_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_member_pkey" PRIMARY KEY ("team_id","user_id")
);

-- CreateTable
CREATE TABLE "message" (
    "message_id" SERIAL NOT NULL,
    "sender_id" INTEGER,
    "recipient_id" INTEGER NOT NULL,
    "category" "MessageCategory" NOT NULL,
    "subject" VARCHAR(200) NOT NULL,
    "body" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_pkey" PRIMARY KEY ("message_id")
);

-- AddForeignKey
ALTER TABLE "team" ADD CONSTRAINT "team_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "user"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_member" ADD CONSTRAINT "team_member_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "team"("team_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_member" ADD CONSTRAINT "team_member_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message" ADD CONSTRAINT "message_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "user"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message" ADD CONSTRAINT "message_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "user"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
