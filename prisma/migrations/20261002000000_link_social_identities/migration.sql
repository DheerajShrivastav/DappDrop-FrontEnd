-- Server-side Discord / Telegram identity binding (additive only; no data rewritten).
ALTER TABLE "User" ADD COLUMN "discordUsername" TEXT;
ALTER TABLE "User" ADD COLUMN "discordLinkedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "telegramId" TEXT;
ALTER TABLE "User" ADD COLUMN "telegramUsername" TEXT;
ALTER TABLE "User" ADD COLUMN "telegramLinkedAt" TIMESTAMP(3);

-- One Telegram account per wallet.
CREATE UNIQUE INDEX "User_telegramId_key" ON "User"("telegramId");
