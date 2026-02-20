/*
  Warnings:

  - Changed the type of `campaignId` on the `CampaignTaskMetadata` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `campaignId` on the `PaymentVerification` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- DropIndex
DROP INDEX "public"."PaymentVerification_transactionHash_idx";

-- AlterTable
ALTER TABLE "public"."CampaignTaskMetadata" ADD COLUMN     "discordServerId" TEXT,
DROP COLUMN "campaignId",
ADD COLUMN     "campaignId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "public"."PaymentVerification" DROP COLUMN "campaignId",
ADD COLUMN     "campaignId" INTEGER NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "CampaignTaskMetadata_campaignId_taskIndex_key" ON "public"."CampaignTaskMetadata"("campaignId", "taskIndex");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentVerification_campaignId_taskIndex_userAddress_key" ON "public"."PaymentVerification"("campaignId", "taskIndex", "userAddress");
