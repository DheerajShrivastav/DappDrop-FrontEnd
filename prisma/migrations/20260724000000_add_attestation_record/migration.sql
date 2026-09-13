-- CreateTable
CREATE TABLE "AttestationRecord" (
    "id" TEXT NOT NULL,
    "campaignId" INTEGER NOT NULL,
    "taskIndex" INTEGER NOT NULL,
    "participant" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL,
    "version" INTEGER NOT NULL,
    "deadline" TIMESTAMP(3) NOT NULL,
    "signerAddress" TEXT NOT NULL,
    "evidence" JSONB NOT NULL,
    "submitted" BOOLEAN NOT NULL DEFAULT false,
    "txHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttestationRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AttestationRecord_campaignId_taskIndex_participant_version_key" ON "AttestationRecord"("campaignId", "taskIndex", "participant", "version");

-- CreateIndex
CREATE INDEX "AttestationRecord_campaignId_taskIndex_participant_idx" ON "AttestationRecord"("campaignId", "taskIndex", "participant");

-- CreateIndex
CREATE INDEX "AttestationRecord_participant_idx" ON "AttestationRecord"("participant");
