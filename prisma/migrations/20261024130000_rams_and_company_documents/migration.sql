-- CreateEnum
CREATE TYPE "CompanyDocumentKind" AS ENUM ('PUBLIC_LIABILITY', 'EMPLOYERS_LIABILITY', 'TRADE_CARD', 'TRAINING', 'SAFETY_POLICY', 'OTHER');

-- CreateEnum
CREATE TYPE "RamsTrade" AS ENUM ('PLUMBING_HEATING', 'ELECTRICAL', 'ROOFING', 'CARPENTRY_JOINERY', 'DECORATING', 'GROUNDWORKS_LANDSCAPING', 'GENERAL_BUILDING');

-- CreateEnum
CREATE TYPE "RamsStatus" AS ENUM ('DRAFT', 'ISSUED');

-- AlterTable
ALTER TABLE "Trader" ADD COLUMN "ramsSeq" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "CompanyDocument" (
    "id" TEXT NOT NULL,
    "traderId" TEXT NOT NULL,
    "kind" "CompanyDocumentKind" NOT NULL,
    "title" TEXT NOT NULL,
    "issuer" TEXT NOT NULL DEFAULT '',
    "referenceNumber" TEXT NOT NULL DEFAULT '',
    "issuedOn" TIMESTAMP(3),
    "expiresOn" TIMESTAMP(3),
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rams" (
    "id" TEXT NOT NULL,
    "traderId" TEXT NOT NULL,
    "jobId" TEXT,
    "customerId" TEXT,
    "number" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "RamsStatus" NOT NULL DEFAULT 'DRAFT',
    "trade" "RamsTrade" NOT NULL,
    "isTemplate" BOOLEAN NOT NULL DEFAULT false,
    "siteAddress" TEXT NOT NULL DEFAULT '',
    "sitePostcode" TEXT NOT NULL DEFAULT '',
    "clientName" TEXT NOT NULL DEFAULT '',
    "clientRole" TEXT NOT NULL DEFAULT 'Client',
    "startOn" TIMESTAMP(3),
    "finishOn" TIMESTAMP(3),
    "scopeOfWork" TEXT NOT NULL DEFAULT '',
    "competentName" TEXT NOT NULL DEFAULT '',
    "competentRole" TEXT NOT NULL DEFAULT '',
    "competentPhone" TEXT NOT NULL DEFAULT '',
    "signedName" TEXT NOT NULL DEFAULT '',
    "signedOn" TIMESTAMP(3),
    "nearestHospital" TEXT NOT NULL DEFAULT '',
    "emergencyNotes" TEXT NOT NULL DEFAULT '',
    "firstAidNotes" TEXT NOT NULL DEFAULT '',
    "welfareNotes" TEXT NOT NULL DEFAULT '',
    "ppe" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Rams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RamsHazard" (
    "id" TEXT NOT NULL,
    "ramsId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "libraryKey" TEXT NOT NULL DEFAULT '',
    "activity" TEXT NOT NULL DEFAULT '',
    "hazard" TEXT NOT NULL,
    "whoHarmed" TEXT NOT NULL DEFAULT '',
    "likelihoodBefore" INTEGER NOT NULL,
    "severityBefore" INTEGER NOT NULL,
    "controls" TEXT NOT NULL,
    "likelihoodAfter" INTEGER NOT NULL,
    "severityAfter" INTEGER NOT NULL,

    CONSTRAINT "RamsHazard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RamsStep" (
    "id" TEXT NOT NULL,
    "ramsId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "detail" TEXT NOT NULL,

    CONSTRAINT "RamsStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RamsSubstance" (
    "id" TEXT NOT NULL,
    "ramsId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "hazard" TEXT NOT NULL DEFAULT '',
    "controls" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "RamsSubstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RamsPermit" (
    "id" TEXT NOT NULL,
    "ramsId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "detail" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "RamsPermit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RamsBriefing" (
    "id" TEXT NOT NULL,
    "ramsId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "operativeName" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT '',
    "briefedOn" TIMESTAMP(3),
    "signatureName" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "RamsBriefing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CompanyDocument_traderId_kind_idx" ON "CompanyDocument"("traderId", "kind");

-- CreateIndex
CREATE INDEX "CompanyDocument_expiresOn_idx" ON "CompanyDocument"("expiresOn");

-- CreateIndex
CREATE INDEX "Rams_traderId_updatedAt_idx" ON "Rams"("traderId", "updatedAt");

-- CreateIndex
CREATE INDEX "Rams_jobId_idx" ON "Rams"("jobId");

-- CreateIndex
CREATE INDEX "Rams_customerId_idx" ON "Rams"("customerId");

-- CreateIndex
CREATE INDEX "Rams_traderId_isTemplate_idx" ON "Rams"("traderId", "isTemplate");

-- CreateIndex
CREATE UNIQUE INDEX "Rams_traderId_number_key" ON "Rams"("traderId", "number");

-- CreateIndex
CREATE INDEX "RamsHazard_ramsId_idx" ON "RamsHazard"("ramsId");

-- CreateIndex
CREATE INDEX "RamsStep_ramsId_idx" ON "RamsStep"("ramsId");

-- CreateIndex
CREATE INDEX "RamsSubstance_ramsId_idx" ON "RamsSubstance"("ramsId");

-- CreateIndex
CREATE INDEX "RamsPermit_ramsId_idx" ON "RamsPermit"("ramsId");

-- CreateIndex
CREATE INDEX "RamsBriefing_ramsId_idx" ON "RamsBriefing"("ramsId");

-- AddForeignKey
ALTER TABLE "CompanyDocument" ADD CONSTRAINT "CompanyDocument_traderId_fkey" FOREIGN KEY ("traderId") REFERENCES "Trader"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rams" ADD CONSTRAINT "Rams_traderId_fkey" FOREIGN KEY ("traderId") REFERENCES "Trader"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rams" ADD CONSTRAINT "Rams_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rams" ADD CONSTRAINT "Rams_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RamsHazard" ADD CONSTRAINT "RamsHazard_ramsId_fkey" FOREIGN KEY ("ramsId") REFERENCES "Rams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RamsStep" ADD CONSTRAINT "RamsStep_ramsId_fkey" FOREIGN KEY ("ramsId") REFERENCES "Rams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RamsSubstance" ADD CONSTRAINT "RamsSubstance_ramsId_fkey" FOREIGN KEY ("ramsId") REFERENCES "Rams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RamsPermit" ADD CONSTRAINT "RamsPermit_ramsId_fkey" FOREIGN KEY ("ramsId") REFERENCES "Rams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RamsBriefing" ADD CONSTRAINT "RamsBriefing_ramsId_fkey" FOREIGN KEY ("ramsId") REFERENCES "Rams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
