import { describe, expect, it } from "vitest";
import { planAfterSubscription, planForPriceId, featureAllowed, priceIdForPlan, billingConfigured } from "@/lib/billing/plans";
import { monitorTarget } from "@/lib/monitor";
import { connectedCheckoutArgs, paidInvoicePatch } from "@/lib/payments/checkout";
import { cardButtonVisible, connectStatusLabel } from "@/lib/payments/connect-status";
import { platformFeePence } from "@/lib/payments/fee";
import { rateLimit, resetRateLimits } from "@/lib/rate-limit";
import { realOutboundAllowed } from "@/lib/sandbox";
import { SECURITY_HEADERS } from "@/lib/security-headers";
import { sendEmail } from "@/lib/email";
import { enquirySpamReason } from "@/lib/spam";

const prices = { STRIPE_SECRET_KEY: "sk_test_x", STRIPE_PRICE_TRADE: "price_trade", STRIPE_PRICE_SPLITSTICK: "price_bundle" };

describe("platform fee", () => {
  it("stays at zero unless basis points are a positive integer", () => {
    expect(platformFeePence(1199, undefined)).toBe(0);
    expect(platformFeePence(1199, "")).toBe(0);
    expect(platformFeePence(1199, "0")).toBe(0);
    expect(platformFeePence(1199, "nope")).toBe(0);
    expect(platformFeePence(10000, "250")).toBe(250);
    expect(platformFeePence(1199, "100")).toBe(11);
  });
});

describe("connected checkout", () => {
  it("charges the connected account by card and omits a fee when the fee is zero", () => {
    const args = connectedCheckoutArgs({
      name: "Invoice I-0002",
      description: "Sample Harbour Heating",
      amountPence: 9500,
      metadata: { invoiceId: "inv" },
      customerEmail: "alex.sample@example.com",
      successUrl: "https://example.test/i/tok",
      cancelUrl: "https://example.test/i/tok?paid=cancelled",
      stripeAccountId: "acct_123",
      feePence: 0,
    });
    expect(args.options).toEqual({ stripeAccount: "acct_123" });
    expect(args.params.payment_method_types).toEqual(["card"]);
    expect(args.params.payment_intent_data).toBeUndefined();
    expect(JSON.stringify(args.params)).not.toContain("bacs");
  });

  it("adds an application fee only when one is due", () => {
    const args = connectedCheckoutArgs({
      name: "Deposit",
      description: "Job",
      amountPence: 3000,
      metadata: { quoteId: "q" },
      customerEmail: null,
      successUrl: "https://example.test/ok",
      cancelUrl: "https://example.test/cancel",
      stripeAccountId: "acct_123",
      feePence: 30,
    });
    expect(args.params.payment_intent_data).toEqual({ application_fee_amount: 30 });
  });

  it("marks a sent invoice paid once", () => {
    const now = new Date("2026-10-18T12:00:00Z");
    expect(paidInvoicePatch({ paidAt: null, status: "SENT", jobCompletedAt: null }, now)).toEqual({
      status: "PAID",
      paidAt: now,
      jobCompletedAt: now,
    });
    expect(paidInvoicePatch({ paidAt: now, status: "PAID", jobCompletedAt: now }, now)).toBeNull();
    expect(paidInvoicePatch({ paidAt: null, status: "DRAFT", jobCompletedAt: null }, now)).toBeNull();
  });
});

describe("plans", () => {
  it("maps price ids and keeps Free useful until billing is configured", () => {
    expect(billingConfigured({})).toBe(false);
    expect(billingConfigured(prices)).toBe(true);
    expect(planForPriceId("price_trade", prices)).toBe("TRADE");
    expect(planForPriceId("price_bundle", prices)).toBe("SPLITSTICK");
    expect(planForPriceId("price_other", prices)).toBeNull();
    expect(priceIdForPlan("TRADE", prices)).toBe("price_trade");
    expect(featureAllowed({ plan: "FREE", feature: "invoices", billingOn: false })).toBe(true);
    expect(featureAllowed({ plan: "FREE", feature: "invoices", billingOn: true })).toBe(false);
    expect(featureAllowed({ plan: "FREE", feature: "whatsapp", billingOn: true, sandbox: true })).toBe(true);
    expect(featureAllowed({ plan: "TRADE", feature: "invoices", billingOn: true })).toBe(true);
    expect(featureAllowed({ plan: "TRADE", feature: "splitstick", billingOn: true })).toBe(false);
    expect(featureAllowed({ plan: "SPLITSTICK", feature: "splitstick", billingOn: true })).toBe(true);
  });

  it("drops the plan when the subscription is no longer paying", () => {
    expect(planAfterSubscription({ status: "active", priceId: "price_trade", env: prices }).plan).toBe("TRADE");
    expect(planAfterSubscription({ status: "past_due", priceId: "price_bundle", env: prices }).plan).toBe("SPLITSTICK");
    expect(planAfterSubscription({ status: "canceled", priceId: "price_trade", env: prices }).plan).toBe("FREE");
    expect(planAfterSubscription({ status: "active", priceId: "price_unknown", env: prices }).plan).toBe("FREE");
  });
});

describe("card button", () => {
  it("stays hidden without a key, without Connect, or on the sample account", () => {
    const ready = {
      stripeConfigured: true,
      sandbox: false,
      stripeAccountId: "acct_123",
      stripeChargesEnabled: true,
      plan: "TRADE" as const,
      billingOn: true,
    };
    expect(cardButtonVisible(ready)).toBe(true);
    expect(cardButtonVisible({ ...ready, stripeConfigured: false })).toBe(false);
    expect(cardButtonVisible({ ...ready, sandbox: true })).toBe(false);
    expect(cardButtonVisible({ ...ready, stripeChargesEnabled: false })).toBe(false);
    expect(cardButtonVisible({ ...ready, plan: "FREE" })).toBe(false);
    expect(connectStatusLabel({ stripeConfigured: false, sandbox: false, stripeAccountId: null, stripeDetailsSubmitted: false, stripeChargesEnabled: false }).label).toBe("Not connected");
  });
});

describe("launch guards", () => {
  it("rate-limits a sliding window", () => {
    resetRateLimits();
    const now = 1_000_000;
    for (let i = 0; i < 8; i += 1) expect(rateLimit("signin:test", 8, 60_000, now).ok).toBe(true);
    expect(rateLimit("signin:test", 8, 60_000, now).ok).toBe(false);
    expect(rateLimit("signin:test", 8, 60_000, now + 60_000).ok).toBe(true);
  });

  it("rejects honeypots, instant submits and link dumps", () => {
    const now = 5_000_000;
    expect(enquirySpamReason({ honeypot: "http://spam.test", startedAt: String(now - 10_000), description: "tap", now })).toBe("honeypot");
    expect(enquirySpamReason({ honeypot: "", startedAt: "", description: "tap", now })).toBe("timing");
    expect(enquirySpamReason({ honeypot: "", startedAt: String(now - 500), description: "tap", now })).toBe("timing");
    expect(enquirySpamReason({ honeypot: "", startedAt: String(now - 10_000), description: "see https://a.test https://b.test https://c.test", now })).toBe("links");
    expect(enquirySpamReason({ honeypot: "", startedAt: String(now - 10_000), description: "Kitchen tap is dripping", now })).toBeNull();
  });

  it("does not send real email or WhatsApp for the sample account", async () => {
    expect(realOutboundAllowed(true)).toBe(false);
    expect(realOutboundAllowed(false)).toBe(true);
    const previous = process.env.SMTP_HOST;
    process.env.SMTP_HOST = "smtp.example.test";
    const result = await sendEmail({ to: "person@example.com", subject: "Hi", text: "Hello", sandbox: true });
    if (previous === undefined) delete process.env.SMTP_HOST;
    else process.env.SMTP_HOST = previous;
    expect(result.stubbed).toBe(true);
    expect(result.delivered).toBe(false);
    expect(result.detail).toMatch(/Sample account/);
  });

  it("reports errors only when a webhook URL is set, and sets browser headers", () => {
    expect(monitorTarget({})).toBeNull();
    expect(monitorTarget({ ERROR_WEBHOOK_URL: " https://errors.example/hook " })).toBe("https://errors.example/hook");
    expect(SECURITY_HEADERS.map((header) => header.key)).toEqual([
      "X-Content-Type-Options",
      "Referrer-Policy",
      "X-Frame-Options",
      "Permissions-Policy",
      "Strict-Transport-Security",
    ]);
  });
});
