-- AlterEnum
ALTER TYPE "SiteRole" ADD VALUE 'guest';

-- CreateTable
CREATE TABLE "guest_invite_token" (
    "id" SERIAL NOT NULL,
    "token" VARCHAR(64) NOT NULL,
    "user_id" INTEGER NOT NULL,
    "tournament_id" INTEGER NOT NULL,
    "seed" INTEGER NOT NULL,
    "expires_at" TIMESTAMP(6) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guest_invite_token_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "guest_invite_token_token_key" ON "guest_invite_token"("token");

-- CreateIndex
CREATE INDEX "guest_invite_token_user_id_idx" ON "guest_invite_token"("user_id");

-- AddForeignKey
ALTER TABLE "guest_invite_token" ADD CONSTRAINT "guest_invite_token_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_invite_token" ADD CONSTRAINT "guest_invite_token_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournament"("tournament_id") ON DELETE CASCADE ON UPDATE CASCADE;
