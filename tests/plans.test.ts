import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { invoiceSubscriptionIds } from "@/lib/billing/invoice-event";
import {
  PLAN_PRICE_PENCE,
  SOLO_INVOICE_MONTHLY_LIMIT,
  SOLO_PHOTO_LIMIT,
  billingSetup,
  featureAllowed,
  londonMonthStart,
  planAfterSubscription,
  upgradeMessage,
  volumeAllows,
  volumeCap,
  type PaidFeature,
} from "@/lib/billing/plans";

const prices = {
  STRIPE_SECRET_KEY: "sk_test_x",
  STRIPE_PRICE_SOLO: "price_solo",
  STRIPE_PRICE_PRO: "price_pro",
  STRIPE_PRICE_TRADE: "price_trade",
  STRIPE_PRICE_SPLITSTICK: "price_bundle",
};

const features: PaidFeature[] = ["invoices", "whatsapp", "photos", "chasers", "card_payments", "manual_jobs", "diary", "splitstick", "cis"];

describe("Solo and Pro", () => {
  it("prices Solo at £14 and Pro at £24", () => {
    expect(PLAN_PRICE_PENCE.SOLO).toBe(1400);
    expect(PLAN_PRICE_PENCE.PRO).toBe(2400);
  });

  it("gives Solo the day-to-day tools and leaves Splitstick prices on Pro", () => {
    for (const feature of features) {
      if (feature === "splitstick" || feature === "cis") {
        expect(featureAllowed({ plan: "SOLO", feature, billingOn: true })).toBe(false);
        expect(featureAllowed({ plan: "PRO", feature, billingOn: true })).toBe(true);
      } else {
        expect(featureAllowed({ plan: "FREE", feature, billingOn: true })).toBe(false);
        expect(featureAllowed({ plan: "SOLO", feature, billingOn: true })).toBe(true);
        expect(featureAllowed({ plan: "PRO", feature, billingOn: true })).toBe(true);
      }
    }
    expect(upgradeMessage("whatsapp")).toMatch(/Receipt photos stay on every plan/);
    expect(upgradeMessage("splitstick")).toMatch(/Pro/);
    expect(upgradeMessage("diary")).toMatch(/Solo/);
    expect(upgradeMessage("cis")).toMatch(/Pro/);
    expect(upgradeMessage("cis")).toMatch(/Nothing was filed/);
  });

  it("caps a new Solo account and leaves a legacy Trade price unlimited", () => {
    expect(volumeCap({ plan: "SOLO", kind: "invoices", billingOn: true })).toBe(SOLO_INVOICE_MONTHLY_LIMIT);
    expect(volumeCap({ plan: "SOLO", kind: "photos", billingOn: true })).toBe(SOLO_PHOTO_LIMIT);
    expect(volumeCap({ plan: "SOLO", kind: "invoices", billingOn: true, legacyUnlimited: true })).toBeNull();
    expect(volumeCap({ plan: "PRO", kind: "invoices", billingOn: true })).toBeNull();
    expect(volumeCap({ plan: "SOLO", kind: "invoices", billingOn: false })).toBeNull();
    expect(volumeCap({ plan: "SOLO", kind: "photos", billingOn: true, sandbox: true })).toBeNull();
    expect(volumeAllows(40, 39, 1)).toBe(true);
    expect(volumeAllows(40, 40, 1)).toBe(false);
    expect(volumeAllows(null, 1000, 1)).toBe(true);
    const legacy = planAfterSubscription({ status: "past_due", priceId: "price_trade", env: prices });
    expect(legacy).toMatchObject({ plan: "SOLO", legacyUnlimited: true, status: "past_due" });
    expect(planAfterSubscription({ status: "active", priceId: "price_solo", env: prices }).legacyUnlimited).toBe(false);
  });

  it("counts a calendar month in London, including British Summer Time", () => {
    expect(londonMonthStart(new Date("2026-01-15T12:00:00.000Z")).toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(londonMonthStart(new Date("2026-06-15T12:00:00.000Z")).toISOString()).toBe("2026-05-31T23:00:00.000Z");
    expect(londonMonthStart(new Date("2026-06-01T00:30:00.000Z")).toISOString()).toBe("2026-05-31T23:00:00.000Z");
  });

  it("says billing is not configured when the test prices are missing, and refuses a live key", () => {
    expect(billingSetup({})).toBe("missing");
    expect(billingSetup({ STRIPE_SECRET_KEY: "sk_test_x" })).toBe("missing");
    expect(billingSetup({ STRIPE_SECRET_KEY: "sk_live_x", STRIPE_PRICE_SOLO: "price_solo", STRIPE_PRICE_PRO: "price_pro" })).toBe("live_key");
    expect(billingSetup(prices)).toBe("ready");
  });

  it("moves Trade to Solo and the Splitstick bundle to Pro in the migration", () => {
    const sql = readFileSync(new URL("../prisma/migrations/20261030190000_solo_pro_plans/migration.sql", import.meta.url), "utf8");
    expect(sql).toContain("WHEN 'TRADE' THEN 'SOLO'");
    expect(sql).toContain("WHEN 'SPLITSTICK' THEN 'PRO'");
    expect(sql).toContain(`"legacyUnlimited" = true WHERE "plan" = 'TRADE'`);
    expect(sql).not.toContain("STRIPE_PLATFORM_FEE_BPS");
  });

  it("does not gate WhatsApp receipt photos on a plan", () => {
    const capture = readFileSync(new URL("../src/lib/receipts/capture.ts", import.meta.url), "utf8");
    const inbound = readFileSync(new URL("../src/lib/whatsapp/inbound.ts", import.meta.url), "utf8");
    expect(capture).not.toContain("featureAllowed");
    expect(inbound).not.toContain("featureAllowed");
    expect(capture).toMatch(/every plan/i);
  });

  it("reads the subscription id from a current or older invoice payload", () => {
    expect(invoiceSubscriptionIds({
      customer: "cus_1",
      parent: { subscription_details: { subscription: "sub_new" } },
    })).toEqual({ customerId: "cus_1", subscriptionId: "sub_new" });
    expect(invoiceSubscriptionIds({
      customer: { id: "cus_2" },
      subscription: { id: "sub_old" },
    })).toEqual({ customerId: "cus_2", subscriptionId: "sub_old" });
  });
});
