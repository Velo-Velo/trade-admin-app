-- AlterTable
ALTER TABLE "Trader" ADD COLUMN "siteTheme" TEXT NOT NULL DEFAULT 'yard';

-- AlterTable
ALTER TABLE "JobPhoto" ADD COLUMN "showOnWebsite" BOOLEAN NOT NULL DEFAULT false;
