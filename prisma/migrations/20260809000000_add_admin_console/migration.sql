-- AlterTable
ALTER TABLE "CampaignCache" ADD COLUMN "hiddenFromDiscovery" BOOLEAN NOT NULL DEFAULT false,
                             ADD COLUMN "hiddenReason" TEXT;

-- CreateTable
CREATE TABLE "KeeperRun" (
    "id" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "endableCount" INTEGER NOT NULL DEFAULT 0,
    "endedCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "alertCount" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,

    CONSTRAINT "KeeperRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KeeperRun_startedAt_idx" ON "KeeperRun"("startedAt");
