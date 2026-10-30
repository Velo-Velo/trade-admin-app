-- AlterTable
ALTER TABLE "Trader" ADD COLUMN "whatsappVerifiedAt" TIMESTAMP(3);

-- Numbers already stored were linked with a code, or belong to the sample account.
UPDATE "Trader" SET "whatsappVerifiedAt" = "updatedAt" WHERE "whatsappE164" IS NOT NULL;

-- CreateEnum
CREATE TYPE "ExpenseStatus" AS ENUM ('NEEDS_REVIEW', 'CONFIRMED');

-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('MATERIALS', 'FUEL', 'TOOLS', 'OTHER');

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "traderId" TEXT NOT NULL,
    "status" "ExpenseStatus" NOT NULL DEFAULT 'NEEDS_REVIEW',
    "supplier" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "spentOn" TIMESTAMP(3),
    "totalPence" INTEGER,
    "vatPence" INTEGER,
    "category" "ExpenseCategory" NOT NULL DEFAULT 'OTHER',
    "extractionNote" TEXT NOT NULL DEFAULT '',
    "imageFilename" TEXT NOT NULL DEFAULT 'receipt.jpg',
    "imageMime" TEXT NOT NULL DEFAULT 'image/jpeg',
    "imageBytes" BYTEA NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'whatsapp',
    "jobId" TEXT,
    "customerId" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Expense_traderId_createdAt_idx" ON "Expense"("traderId", "createdAt");

-- CreateIndex
CREATE INDEX "Expense_traderId_status_idx" ON "Expense"("traderId", "status");

-- CreateIndex
CREATE INDEX "Expense_jobId_idx" ON "Expense"("jobId");

-- CreateIndex
CREATE INDEX "Expense_customerId_idx" ON "Expense"("customerId");

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_traderId_fkey" FOREIGN KEY ("traderId") REFERENCES "Trader"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
