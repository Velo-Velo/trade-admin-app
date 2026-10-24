-- AlterEnum
ALTER TYPE "RamsStatus" ADD VALUE 'AWAITING_SIGNATURES';
ALTER TYPE "RamsStatus" ADD VALUE 'SIGNED';

-- CreateEnum
CREATE TYPE "RamsSignerKind" AS ENUM ('APPROVER', 'OPERATIVE');

-- AlterTable
ALTER TABLE "CompanyDocument" ADD COLUMN "fileName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "CompanyDocument" ADD COLUMN "fileMime" TEXT NOT NULL DEFAULT '';
ALTER TABLE "CompanyDocument" ADD COLUMN "fileBytes" BYTEA;
ALTER TABLE "CompanyDocument" ADD COLUMN "storageKey" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Rams" ADD COLUMN "contentVersion" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "RamsBriefing" ADD COLUMN "phone" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "RamsSigner" (
    "id" TEXT NOT NULL,
    "ramsId" TEXT NOT NULL,
    "kind" "RamsSignerKind" NOT NULL,
    "name" TEXT NOT NULL,
    "roleLabel" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RamsSigner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RamsSignature" (
    "id" TEXT NOT NULL,
    "ramsId" TEXT NOT NULL,
    "signerId" TEXT,
    "kind" "RamsSignerKind" NOT NULL,
    "name" TEXT NOT NULL,
    "roleLabel" TEXT NOT NULL DEFAULT '',
    "image" BYTEA NOT NULL,
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contentVersion" INTEGER NOT NULL,
    "invalidatedAt" TIMESTAMP(3),
    "invalidReason" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "RamsSignature_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RamsSigner_token_key" ON "RamsSigner"("token");
CREATE INDEX "RamsSigner_ramsId_kind_idx" ON "RamsSigner"("ramsId", "kind");
CREATE INDEX "RamsSignature_ramsId_contentVersion_idx" ON "RamsSignature"("ramsId", "contentVersion");
CREATE INDEX "RamsSignature_signerId_idx" ON "RamsSignature"("signerId");

-- AddForeignKey
ALTER TABLE "RamsSigner" ADD CONSTRAINT "RamsSigner_ramsId_fkey" FOREIGN KEY ("ramsId") REFERENCES "Rams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RamsSignature" ADD CONSTRAINT "RamsSignature_ramsId_fkey" FOREIGN KEY ("ramsId") REFERENCES "Rams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RamsSignature" ADD CONSTRAINT "RamsSignature_signerId_fkey" FOREIGN KEY ("signerId") REFERENCES "RamsSigner"("id") ON DELETE SET NULL ON UPDATE CASCADE;
