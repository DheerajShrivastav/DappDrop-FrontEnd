-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "username" TEXT,
    "email" TEXT,
    "notificationSettings" JSONB,
    "preferences" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CampaignCache" (
    "id" TEXT NOT NULL,
    "campaignId" INTEGER NOT NULL,
    "contractAddress" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "hostAddress" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL,
    "imageUrl" TEXT,
    "tags" TEXT[],
    "featuredUntil" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SocialVerification" (
    "id" TEXT NOT NULL,
    "userAddress" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "proofData" JSONB NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "isValid" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SocialVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Analytics" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "userAddress" TEXT,
    "campaignId" INTEGER,
    "data" JSONB NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Analytics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_walletAddress_key" ON "public"."User"("walletAddress");
