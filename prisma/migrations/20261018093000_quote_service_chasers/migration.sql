-- CreateEnum
CREATE TYPE "ChaseKind" AS ENUM ('QUOTE', 'SERVICE');

-- CreateEnum
CREATE TYPE "ChaseStatus" AS ENUM ('PENDING', 'SENT', 'DISMISSED');

-- AlterEnum
ALTER TYPE "QuoteStatus" ADD VALUE 'LOST';

-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "intervalMonths" INTEGER NOT NULL DEFAULT 12,
ADD COLUMN     "lastServiceChasedAt" TIMESTAMP(3),
ADD COLUMN     "recurring" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "serviceChaseStage" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "serviceDueAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Quote" ADD COLUMN     "chaseStage" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastChasedAt" TIMESTAMP(3),
ADD COLUMN     "lostAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Trader" ADD COLUMN     "autoSendQuoteChasers" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "quoteChaseDays" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "quoteChaseSecondNudge" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "serviceRemindWeeks" INTEGER NOT NULL DEFAULT 4;

-- CreateTable
CREATE TABLE "CustomerChase" (
    "id" TEXT NOT NULL,
    "traderId" TEXT NOT NULL,
    "kind" "ChaseKind" NOT NULL,
    "status" "ChaseStatus" NOT NULL DEFAULT 'PENDING',
    "quoteId" TEXT,
    "jobId" TEXT,
    "stage" INTEGER NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "CustomerChase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomerChase_traderId_status_idx" ON "CustomerChase"("traderId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerChase_quoteId_stage_key" ON "CustomerChase"("quoteId", "stage");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerChase_jobId_stage_key" ON "CustomerChase"("jobId", "stage");

-- CreateIndex
CREATE INDEX "Job_serviceDueAt_idx" ON "Job"("serviceDueAt");

-- AddForeignKey
ALTER TABLE "CustomerChase" ADD CONSTRAINT "CustomerChase_traderId_fkey" FOREIGN KEY ("traderId") REFERENCES "Trader"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerChase" ADD CONSTRAINT "CustomerChase_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerChase" ADD CONSTRAINT "CustomerChase_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

