-- CreateTable
CREATE TABLE "public"."PaymentVerification" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "taskIndex" INTEGER NOT NULL,
    "userAddress" TEXT NOT NULL,
    "transactionHash" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentVerification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentVerification_transactionHash_key" ON "public"."PaymentVerification"("transactionHash");

-- CreateIndex
CREATE INDEX "PaymentVerification_transactionHash_idx" ON "public"."PaymentVerification"("transactionHash");

-- CreateIndex
CREATE INDEX "PaymentVerification_userAddress_idx" ON "public"."PaymentVerification"("userAddress");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentVerification_campaignId_taskIndex_userAddress_key" ON "public"."PaymentVerification"("campaignId", "taskIndex", "userAddress");
