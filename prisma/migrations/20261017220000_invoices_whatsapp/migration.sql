-- AlterEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'SENT', 'PAID');

-- AlterTable
ALTER TABLE "Trader"
ADD COLUMN "invoiceSeq" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "whatsappE164" TEXT,
ADD COLUMN "whatsappLinkCodeHash" TEXT,
ADD COLUMN "whatsappLinkExpiresAt" TIMESTAMP(3),
ADD COLUMN "bankAccountName" TEXT NOT NULL DEFAULT '',
ADD COLUMN "bankSortCode" TEXT NOT NULL DEFAULT '',
ADD COLUMN "bankAccountNumber" TEXT NOT NULL DEFAULT '',
ADD COLUMN "tradingAddress" TEXT NOT NULL DEFAULT '',
ADD COLUMN "vatRegistered" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "vatNumber" TEXT NOT NULL DEFAULT '',
ADD COLUMN "googleReviewUrl" TEXT NOT NULL DEFAULT '',
ADD COLUMN "reviewChasersEnabled" BOOLEAN NOT NULL DEFAULT true;

CREATE UNIQUE INDEX "Trader_whatsappE164_key" ON "Trader"("whatsappE164");

-- AlterTable
ALTER TABLE "Quote"
ADD COLUMN "stripePaymentLinkId" TEXT,
ADD COLUMN "stripePaymentUrl" TEXT,
ADD COLUMN "reviewToken" TEXT,
ADD COLUMN "reviewChaserEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "reviewStage" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "lastReviewAt" TIMESTAMP(3),
ADD COLUMN "reviewClickedAt" TIMESTAMP(3),
ADD COLUMN "jobCompletedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "Quote_reviewToken_key" ON "Quote"("reviewToken");
CREATE INDEX "Quote_stripePaymentLinkId_idx" ON "Quote"("stripePaymentLinkId");

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "traderId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "customerName" TEXT NOT NULL,
    "customerContact" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL,
    "netPence" INTEGER NOT NULL,
    "vatPence" INTEGER NOT NULL,
    "totalPence" INTEGER NOT NULL,
    "vatRate" INTEGER NOT NULL DEFAULT 0,
    "publicToken" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "chaserEnabled" BOOLEAN NOT NULL DEFAULT true,
    "chaserStage" INTEGER NOT NULL DEFAULT 0,
    "lastChasedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "stripePaymentLinkId" TEXT,
    "stripePaymentUrl" TEXT,
    "businessName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "tradingAddress" TEXT NOT NULL DEFAULT '',
    "vatNumber" TEXT NOT NULL DEFAULT '',
    "bankAccountName" TEXT NOT NULL DEFAULT '',
    "bankSortCode" TEXT NOT NULL DEFAULT '',
    "bankAccountNumber" TEXT NOT NULL DEFAULT '',
    "reviewToken" TEXT NOT NULL,
    "reviewChaserEnabled" BOOLEAN NOT NULL DEFAULT true,
    "reviewStage" INTEGER NOT NULL DEFAULT 0,
    "lastReviewAt" TIMESTAMP(3),
    "reviewClickedAt" TIMESTAMP(3),
    "jobCompletedAt" TIMESTAMP(3),
    "source" TEXT NOT NULL DEFAULT 'dashboard',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InvoiceEvent" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "detail" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WhatsAppMessage" (
    "id" TEXT NOT NULL,
    "traderId" TEXT,
    "phone" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WhatsAppReceipt" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppReceipt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Invoice_publicToken_key" ON "Invoice"("publicToken");
CREATE UNIQUE INDEX "Invoice_reviewToken_key" ON "Invoice"("reviewToken");
CREATE UNIQUE INDEX "Invoice_traderId_number_key" ON "Invoice"("traderId", "number");
CREATE INDEX "Invoice_traderId_status_idx" ON "Invoice"("traderId", "status");
CREATE INDEX "Invoice_dueAt_idx" ON "Invoice"("dueAt");
CREATE INDEX "Invoice_stripePaymentLinkId_idx" ON "Invoice"("stripePaymentLinkId");
CREATE INDEX "InvoiceEvent_invoiceId_idx" ON "InvoiceEvent"("invoiceId");
CREATE INDEX "WhatsAppMessage_phone_createdAt_idx" ON "WhatsAppMessage"("phone", "createdAt");
CREATE INDEX "WhatsAppMessage_traderId_createdAt_idx" ON "WhatsAppMessage"("traderId", "createdAt");

ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_traderId_fkey" FOREIGN KEY ("traderId") REFERENCES "Trader"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InvoiceEvent" ADD CONSTRAINT "InvoiceEvent_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WhatsAppMessage" ADD CONSTRAINT "WhatsAppMessage_traderId_fkey" FOREIGN KEY ("traderId") REFERENCES "Trader"("id") ON DELETE CASCADE ON UPDATE CASCADE;
