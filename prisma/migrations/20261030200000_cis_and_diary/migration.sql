-- CreateEnum
CREATE TYPE "CisStatus" AS ENUM ('NOT_USED', 'GROSS', 'STANDARD', 'HIGHER');

-- AlterTable
ALTER TABLE "Trader" ADD COLUMN "cisStatus" "CisStatus" NOT NULL DEFAULT 'NOT_USED';
ALTER TABLE "Trader" ADD COLUMN "cisUtr" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN "deductsCis" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Customer" ADD COLUMN "cisRateOverride" INTEGER;

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN "labourPence" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Invoice" ADD COLUMN "materialsPence" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Invoice" ADD COLUMN "cisApplies" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Invoice" ADD COLUMN "cisRate" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Invoice" ADD COLUMN "cisDeductionPence" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Invoice" ADD COLUMN "amountDuePence" INTEGER NOT NULL DEFAULT 0;

-- Existing invoices had no CIS split. Keep the net as labour and the amount due as the total.
UPDATE "Invoice"
SET "labourPence" = "netPence",
    "materialsPence" = 0,
    "amountDuePence" = "totalPence"
WHERE "cisApplies" = false;

-- CreateIndex
CREATE INDEX "Invoice_traderId_cisApplies_idx" ON "Invoice"("traderId", "cisApplies");

-- CreateTable
CREATE TABLE "JobVisit" (
    "id" TEXT NOT NULL,
    "traderId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "scheduledTime" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobVisit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JobVisit_traderId_scheduledFor_idx" ON "JobVisit"("traderId", "scheduledFor");

-- CreateIndex
CREATE INDEX "JobVisit_jobId_idx" ON "JobVisit"("jobId");

-- AddForeignKey
ALTER TABLE "JobVisit" ADD CONSTRAINT "JobVisit_traderId_fkey" FOREIGN KEY ("traderId") REFERENCES "Trader"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobVisit" ADD CONSTRAINT "JobVisit_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
