-- DropForeignKey
ALTER TABLE "message" DROP CONSTRAINT "message_recipient_id_fkey";

-- AlterTable
ALTER TABLE "message" ADD COLUMN     "recipient_name" VARCHAR(100),
ADD COLUMN     "sender_name" VARCHAR(100),
ALTER COLUMN "recipient_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "message" ADD CONSTRAINT "message_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "user"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;
