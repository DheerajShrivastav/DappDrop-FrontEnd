-- CreateTable
CREATE TABLE "VerificationFailure" (
    "id" TEXT NOT NULL,
    "campaignId" INTEGER NOT NULL,
    "taskIndex" INTEGER NOT NULL,
    "taskType" TEXT,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationFailure_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VerificationFailure_campaignId_taskIndex_idx" ON "VerificationFailure"("campaignId", "taskIndex");
