-- CreateEnum
CREATE TYPE "MessagePrivacy" AS ENUM ('everyone', 'friends_only');

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "allow_messages_from" "MessagePrivacy" NOT NULL DEFAULT 'everyone';
