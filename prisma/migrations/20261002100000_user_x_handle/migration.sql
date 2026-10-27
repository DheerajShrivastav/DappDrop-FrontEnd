-- Participant's self-entered X handle (unverified). Additive only.
ALTER TABLE "User" ADD COLUMN "xHandle" TEXT;
ALTER TABLE "User" ADD COLUMN "xHandleUpdatedAt" TIMESTAMP(3);
