-- CreateEnum
CREATE TYPE "PlanTier" AS ENUM ('FREE', 'TRADE', 'SPLITSTICK');

-- CreateEnum
CREATE TYPE "MagicPurpose" AS ENUM ('SIGN_IN', 'VERIFY_EMAIL', 'RESET_PASSWORD');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "MagicLink" ADD COLUMN "purpose" "MagicPurpose" NOT NULL DEFAULT 'SIGN_IN';

-- AlterTable
ALTER TABLE "Trader" ADD COLUMN "plan" "PlanTier" NOT NULL DEFAULT 'FREE',
ADD COLUMN "stripeAccountId" TEXT,
ADD COLUMN "stripeChargesEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "stripeDetailsSubmitted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "stripePayoutsEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "stripeCustomerId" TEXT,
ADD COLUMN "subscriptionStatus" TEXT NOT NULL DEFAULT '',
ADD COLUMN "subscriptionPriceId" TEXT NOT NULL DEFAULT '';

-- CreateIndex
CREATE UNIQUE INDEX "Trader_stripeAccountId_key" ON "Trader"("stripeAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Trader_stripeCustomerId_key" ON "Trader"("stripeCustomerId");
