-- A portal cancellation keeps the subscription active until the period ends.
-- These columns remember that, and are cleared when the trader undoes it.

ALTER TABLE "Trader" ADD COLUMN "subscriptionCancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Trader" ADD COLUMN "subscriptionCancelAt" TIMESTAMP(3);
