-- AlterTable
ALTER TABLE "User"
  ADD COLUMN "moderationFlagged" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "moderationReason" TEXT;

-- CreateTable
CREATE TABLE "SponsoredClaim" (
    "id" TEXT NOT NULL,
    "campaignId" INTEGER NOT NULL,
    "account" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "proof" JSONB NOT NULL,
    "token" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "declineReason" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "nonce" INTEGER,
    "txHash" TEXT,
    "gasUsed" TEXT,
    "effGasPrice" TEXT,
    "gasCostWei" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "SponsoredClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignSponsorshipBudget" (
    "id" TEXT NOT NULL,
    "campaignId" INTEGER NOT NULL,
    "budgetWei" TEXT NOT NULL,
    "spentWei" TEXT NOT NULL DEFAULT '0',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignSponsorshipBudget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RelayerDailySpend" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "spentWei" TEXT NOT NULL DEFAULT '0',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RelayerDailySpend_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RelayerControl" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "killSwitchEnabled" BOOLEAN NOT NULL DEFAULT false,
    "killSwitchReason" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RelayerControl_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SponsoredClaim_campaignId_account_key" ON "SponsoredClaim"("campaignId", "account");

-- CreateIndex
CREATE INDEX "SponsoredClaim_status_idx" ON "SponsoredClaim"("status");

-- CreateIndex
CREATE INDEX "SponsoredClaim_campaignId_idx" ON "SponsoredClaim"("campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignSponsorshipBudget_campaignId_key" ON "CampaignSponsorshipBudget"("campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "RelayerDailySpend_date_key" ON "RelayerDailySpend"("date");
