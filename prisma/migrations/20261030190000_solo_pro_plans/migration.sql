-- Free stays Free.
-- Trade (£11.99) becomes Solo and keeps an unlimited allowance, because those
-- subscriptions were not capped. Splitstick bundle (£16.99) becomes Pro so the
-- receipt price feed stays on. Stripe is not changed here: the old price keeps
-- billing until the trader switches in the customer portal.
-- WhatsApp receipt photos are not a plan column. They stay available on every tier.

ALTER TABLE "Trader" ADD COLUMN "legacyUnlimited" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Trader" ADD COLUMN "stripeSubscriptionId" TEXT;

UPDATE "Trader" SET "legacyUnlimited" = true WHERE "plan" = 'TRADE';

CREATE TYPE "PlanTier_new" AS ENUM ('FREE', 'SOLO', 'PRO');

ALTER TABLE "Trader" ALTER COLUMN "plan" DROP DEFAULT;
ALTER TABLE "Trader"
  ALTER COLUMN "plan" TYPE "PlanTier_new"
  USING (
    CASE "plan"::text
      WHEN 'TRADE' THEN 'SOLO'
      WHEN 'SPLITSTICK' THEN 'PRO'
      ELSE 'FREE'
    END
  )::"PlanTier_new";

ALTER TYPE "PlanTier" RENAME TO "PlanTier_old";
ALTER TYPE "PlanTier_new" RENAME TO "PlanTier";
DROP TYPE "PlanTier_old";

ALTER TABLE "Trader" ALTER COLUMN "plan" SET DEFAULT 'FREE';

CREATE UNIQUE INDEX "Trader_stripeSubscriptionId_key" ON "Trader"("stripeSubscriptionId");
