-- CreateTable
CREATE TABLE "public"."CampaignTaskMetadata" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "taskIndex" INTEGER NOT NULL,
    "taskType" TEXT NOT NULL,
    "discordInviteLink" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignTaskMetadata_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CampaignTaskMetadata_campaignId_taskIndex_key" ON "public"."CampaignTaskMetadata"("campaignId", "taskIndex");
