-- CreateEnum
CREATE TYPE "Trade" AS ENUM ('PLUMBING_HEATING', 'ELECTRICAL', 'BUILDING', 'GENERAL');

-- CreateEnum
CREATE TYPE "LineKind" AS ENUM ('LABOUR', 'MATERIAL');

-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'DECLINED');

-- CreateEnum
CREATE TYPE "ChecklistStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'DONE', 'NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "PriceSource" AS ENUM ('MANUAL', 'SPLITSTICK');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MagicLink" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MagicLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trader" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "trade" "Trade" NOT NULL,
    "area" TEXT NOT NULL,
    "postcodes" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "logoText" TEXT NOT NULL,
    "brandColour" TEXT NOT NULL,
    "services" TEXT NOT NULL,
    "bio" TEXT NOT NULL DEFAULT '',
    "quoteSeq" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Trader_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Enquiry" (
    "id" TEXT NOT NULL,
    "traderId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "contact" TEXT NOT NULL,
    "postcode" TEXT NOT NULL,
    "jobDescription" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'website',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Enquiry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnquiryPhoto" (
    "id" TEXT NOT NULL,
    "enquiryId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "bytes" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnquiryPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobTemplate" (
    "id" TEXT NOT NULL,
    "trade" "Trade" NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "keywords" TEXT NOT NULL,

    CONSTRAINT "JobTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobTemplateLine" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "kind" "LineKind" NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "unit" TEXT NOT NULL,
    "starterPricePence" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "JobTemplateLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceBookItem" (
    "id" TEXT NOT NULL,
    "traderId" TEXT NOT NULL,
    "kind" "LineKind" NOT NULL,
    "description" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "sellPricePence" INTEGER NOT NULL,
    "lastPaidPence" INTEGER,
    "lastPaidAt" TIMESTAMP(3),
    "source" "PriceSource" NOT NULL DEFAULT 'MANUAL',
    "splitstickReceiptId" TEXT,
    "merchant" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceBookItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quote" (
    "id" TEXT NOT NULL,
    "traderId" TEXT NOT NULL,
    "enquiryId" TEXT,
    "number" TEXT NOT NULL,
    "status" "QuoteStatus" NOT NULL DEFAULT 'DRAFT',
    "customerName" TEXT NOT NULL,
    "customerContact" TEXT NOT NULL,
    "postcode" TEXT NOT NULL,
    "jobDescription" TEXT NOT NULL,
    "publicToken" TEXT NOT NULL,
    "domestic" BOOLEAN NOT NULL DEFAULT true,
    "depositPercent" INTEGER NOT NULL DEFAULT 30,
    "coolingOffText" TEXT NOT NULL DEFAULT '',
    "draftNote" TEXT NOT NULL DEFAULT '',
    "approvedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "declinedAt" TIMESTAMP(3),
    "depositPaidAt" TIMESTAMP(3),
    "stripeSessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteLine" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "kind" "LineKind" NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "unit" TEXT NOT NULL,
    "unitPricePence" INTEGER NOT NULL,
    "priceBookItemId" TEXT,
    "lastPaidPence" INTEGER,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "QuoteLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteEvent" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "detail" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuoteEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistItem" (
    "id" TEXT NOT NULL,
    "traderId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "officialUrl" TEXT NOT NULL,
    "verifyUrl" TEXT NOT NULL,
    "badgeLabel" TEXT NOT NULL DEFAULT '',
    "publicRegister" BOOLEAN NOT NULL DEFAULT false,
    "status" "ChecklistStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "referenceNumber" TEXT NOT NULL DEFAULT '',
    "expiresAt" TIMESTAMP(3),
    "showOnWebsite" BOOLEAN NOT NULL DEFAULT false,
    "reminderDays" INTEGER NOT NULL DEFAULT 30,
    "lastRemindedAt" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "ChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MagicLink_tokenHash_key" ON "MagicLink"("tokenHash");

-- CreateIndex
CREATE INDEX "MagicLink_email_idx" ON "MagicLink"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Trader_userId_key" ON "Trader"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Trader_slug_key" ON "Trader"("slug");

-- CreateIndex
CREATE INDEX "Enquiry_traderId_createdAt_idx" ON "Enquiry"("traderId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "JobTemplate_slug_key" ON "JobTemplate"("slug");

-- CreateIndex
CREATE INDEX "PriceBookItem_traderId_idx" ON "PriceBookItem"("traderId");

-- CreateIndex
CREATE INDEX "PriceBookItem_splitstickReceiptId_idx" ON "PriceBookItem"("splitstickReceiptId");

-- CreateIndex
CREATE UNIQUE INDEX "Quote_enquiryId_key" ON "Quote"("enquiryId");

-- CreateIndex
CREATE UNIQUE INDEX "Quote_publicToken_key" ON "Quote"("publicToken");

-- CreateIndex
CREATE INDEX "Quote_traderId_status_idx" ON "Quote"("traderId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Quote_traderId_number_key" ON "Quote"("traderId", "number");

-- CreateIndex
CREATE INDEX "QuoteEvent_quoteId_idx" ON "QuoteEvent"("quoteId");

-- CreateIndex
CREATE INDEX "ChecklistItem_expiresAt_idx" ON "ChecklistItem"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "ChecklistItem_traderId_key_key" ON "ChecklistItem"("traderId", "key");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trader" ADD CONSTRAINT "Trader_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enquiry" ADD CONSTRAINT "Enquiry_traderId_fkey" FOREIGN KEY ("traderId") REFERENCES "Trader"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnquiryPhoto" ADD CONSTRAINT "EnquiryPhoto_enquiryId_fkey" FOREIGN KEY ("enquiryId") REFERENCES "Enquiry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobTemplateLine" ADD CONSTRAINT "JobTemplateLine_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "JobTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceBookItem" ADD CONSTRAINT "PriceBookItem_traderId_fkey" FOREIGN KEY ("traderId") REFERENCES "Trader"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_traderId_fkey" FOREIGN KEY ("traderId") REFERENCES "Trader"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_enquiryId_fkey" FOREIGN KEY ("enquiryId") REFERENCES "Enquiry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteLine" ADD CONSTRAINT "QuoteLine_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteEvent" ADD CONSTRAINT "QuoteEvent_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistItem" ADD CONSTRAINT "ChecklistItem_traderId_fkey" FOREIGN KEY ("traderId") REFERENCES "Trader"("id") ON DELETE CASCADE ON UPDATE CASCADE;
