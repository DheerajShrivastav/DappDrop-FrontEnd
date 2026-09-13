-- AlterTable
ALTER TABLE "CampaignCache"
  ADD COLUMN "humanityGated" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "allocationPolicy" TEXT NOT NULL DEFAULT 'EQUAL_SPLIT';

-- CreateTable
CREATE TABLE "MerkleTree" (
    "id" TEXT NOT NULL,
    "campaignId" INTEGER NOT NULL,
    "version" INTEGER NOT NULL,
    "root" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "totalAmount" TEXT NOT NULL,
    "policy" TEXT NOT NULL,
    "treeJson" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PROPOSED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "MerkleTree_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AllocationEntry" (
    "id" TEXT NOT NULL,
    "merkleTreeId" TEXT NOT NULL,
    "campaignId" INTEGER NOT NULL,
    "wallet" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "leafIndex" INTEGER NOT NULL,
    "tasksCompleted" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AllocationEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MerkleTree_campaignId_version_key" ON "MerkleTree"("campaignId", "version");

-- CreateIndex
CREATE INDEX "MerkleTree_campaignId_status_idx" ON "MerkleTree"("campaignId", "status");

-- CreateIndex
CREATE INDEX "MerkleTree_campaignId_root_idx" ON "MerkleTree"("campaignId", "root");

-- CreateIndex
CREATE UNIQUE INDEX "AllocationEntry_merkleTreeId_wallet_key" ON "AllocationEntry"("merkleTreeId", "wallet");

-- CreateIndex
CREATE INDEX "AllocationEntry_campaignId_wallet_idx" ON "AllocationEntry"("campaignId", "wallet");

-- AddForeignKey
ALTER TABLE "AllocationEntry" ADD CONSTRAINT "AllocationEntry_merkleTreeId_fkey" FOREIGN KEY ("merkleTreeId") REFERENCES "MerkleTree"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
