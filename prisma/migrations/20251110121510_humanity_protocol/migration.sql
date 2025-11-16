-- AlterTable
ALTER TABLE "public"."CampaignTaskMetadata" ADD COLUMN     "requiresHumanityVerification" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "humanityVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastHumanityCheck" TIMESTAMP(3);
