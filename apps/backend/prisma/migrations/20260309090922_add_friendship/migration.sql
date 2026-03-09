-- CreateEnum
CREATE TYPE "FriendshipStatus" AS ENUM ('pending', 'accepted', 'blocked');

-- AlterTable
ALTER TABLE "message" ADD COLUMN     "reference_id" INTEGER;

-- AlterTable
ALTER TABLE "tournament_participant" ADD COLUMN     "confirmed" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "friendship" (
    "friendship_id" SERIAL NOT NULL,
    "requester_id" INTEGER NOT NULL,
    "recipient_id" INTEGER NOT NULL,
    "status" "FriendshipStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "friendship_pkey" PRIMARY KEY ("friendship_id")
);

-- CreateIndex
CREATE INDEX "friendship_recipient_id_idx" ON "friendship"("recipient_id");

-- CreateIndex
CREATE UNIQUE INDEX "friendship_requester_id_recipient_id_key" ON "friendship"("requester_id", "recipient_id");

-- AddForeignKey
ALTER TABLE "friendship" ADD CONSTRAINT "friendship_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "user"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "friendship" ADD CONSTRAINT "friendship_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "user"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
