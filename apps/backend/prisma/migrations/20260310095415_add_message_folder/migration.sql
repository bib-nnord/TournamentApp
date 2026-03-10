-- CreateEnum
CREATE TYPE "MessageFolder" AS ENUM ('inbox', 'sent');

-- AlterTable
ALTER TABLE "message" ADD COLUMN     "folder" "MessageFolder" NOT NULL DEFAULT 'inbox';
