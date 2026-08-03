-- AlterTable
ALTER TABLE "User" ADD COLUMN "humanityRevokedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "MerkleTree" ADD COLUMN "excludedForHumanity" TEXT[];
