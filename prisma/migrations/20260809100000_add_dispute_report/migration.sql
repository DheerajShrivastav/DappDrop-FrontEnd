-- P4: dispute-window concern reporting
CREATE TABLE "DisputeReport" (
    "id" TEXT NOT NULL,
    "campaignId" INTEGER NOT NULL,
    "reporterWallet" TEXT NOT NULL,
    "merkleRoot" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "hostResponse" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DisputeReport_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DisputeReport_campaignId_merkleRoot_reporterWallet_key" ON "DisputeReport"("campaignId", "merkleRoot", "reporterWallet");

CREATE INDEX "DisputeReport_campaignId_merkleRoot_status_idx" ON "DisputeReport"("campaignId", "merkleRoot", "status");
