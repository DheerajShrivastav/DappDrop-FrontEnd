-- AlterTable
ALTER TABLE "MerkleTree" ADD COLUMN "rewardKind" TEXT NOT NULL DEFAULT 'ERC20';

-- AlterTable
ALTER TABLE "AllocationEntry" ADD COLUMN "nftStandard" TEXT,
                               ADD COLUMN "tokenId" TEXT;

-- CreateTable
CREATE TABLE "NFTDeposit" (
    "id" TEXT NOT NULL,
    "campaignId" INTEGER NOT NULL,
    "tokenAddress" TEXT NOT NULL,
    "standard" TEXT NOT NULL,
    "tokenId" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "allocated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NFTDeposit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NFTDeposit_campaignId_tokenAddress_tokenId_key" ON "NFTDeposit"("campaignId", "tokenAddress", "tokenId");

-- CreateIndex
CREATE INDEX "NFTDeposit_campaignId_allocated_idx" ON "NFTDeposit"("campaignId", "allocated");

-- AlterTable
ALTER TABLE "SponsoredClaim" ADD COLUMN "nftStandard" TEXT,
                              ADD COLUMN "tokenId" TEXT;
