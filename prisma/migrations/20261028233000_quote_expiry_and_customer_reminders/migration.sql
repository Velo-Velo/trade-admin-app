-- AlterEnum
ALTER TYPE "QuoteStatus" ADD VALUE 'EXPIRED';

-- AlterTable
ALTER TABLE "Trader" ADD COLUMN     "quoteChaseSecondDays" INTEGER NOT NULL DEFAULT 7,
ADD COLUMN     "quoteChasersEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "quoteValidDays" INTEGER NOT NULL DEFAULT 30;

-- AlterTable
ALTER TABLE "Quote" ADD COLUMN     "chaseEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "expiredAt" TIMESTAMP(3),
ADD COLUMN     "expiresAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ServiceReminder" (
    "id" TEXT NOT NULL,
    "traderId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "jobId" TEXT,
    "title" TEXT NOT NULL,
    "intervalMonths" INTEGER NOT NULL DEFAULT 12,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "chaseStage" INTEGER NOT NULL DEFAULT 0,
    "lastChasedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceReminder_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "CustomerChase" ADD COLUMN     "serviceReminderId" TEXT;

-- CreateIndex
CREATE INDEX "Quote_expiresAt_idx" ON "Quote"("expiresAt");

-- CreateIndex
CREATE INDEX "ServiceReminder_traderId_dueAt_idx" ON "ServiceReminder"("traderId", "dueAt");

-- CreateIndex
CREATE INDEX "ServiceReminder_customerId_idx" ON "ServiceReminder"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerChase_serviceReminderId_stage_key" ON "CustomerChase"("serviceReminderId", "stage");

-- AddForeignKey
ALTER TABLE "ServiceReminder" ADD CONSTRAINT "ServiceReminder_traderId_fkey" FOREIGN KEY ("traderId") REFERENCES "Trader"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceReminder" ADD CONSTRAINT "ServiceReminder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceReminder" ADD CONSTRAINT "ServiceReminder_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerChase" ADD CONSTRAINT "CustomerChase_serviceReminderId_fkey" FOREIGN KEY ("serviceReminderId") REFERENCES "ServiceReminder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
