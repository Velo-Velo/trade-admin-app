import { describe, expect, it } from "vitest";
import Stripe from "stripe";
import { planAfterSubscription, planForPriceId, featureAllowed, priceIdForPlan, billingConfigured } from "@/lib/billing/plans";
import { monitorTarget } from "@/lib/monitor";
import { connectedCheckoutArgs, paidInvoicePatch } from "@/lib/payments/checkout";
import {
  accountIdFromThinNotification,
  accountLinkParams,
  connectFlagsFromV2Account,
  expressAccountCreateParams,
  isThinEventPayload,
} from "@/lib/payments/connect-account";
import { publicStripeReason } from "@/lib/payments/stripe-reason";
import { cardButtonVisible, connectStatusLabel } from "@/lib/payments/connect-status";
import { platformFeePence } from "@/lib/payments/fee";
import { constructStripeEvent, stripeEventKind, stripeWebhookSecrets } from "@/lib/payments/webhook";
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

  it("sends a v2 account id on the stripeAccount header for a direct charge", () => {
    const args = connectedCheckoutArgs({
      name: "Deposit",
      description: "Job",
      amountPence: 3000,
      metadata: { quoteId: "q" },
      customerEmail: null,
      successUrl: "https://example.test/ok",
      cancelUrl: "https://example.test/cancel",
      stripeAccountId: "acct_v2_trader",
      feePence: 0,
    });
    expect(args.options).toEqual({ stripeAccount: "acct_v2_trader" });
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
    expect(featureAllowed({ plan: "TRADE", feature: "diary", billingOn: true })).toBe(true);
    expect(featureAllowed({ plan: "TRADE", feature: "cis", billingOn: true })).toBe(false);
    expect(featureAllowed({ plan: "FREE", feature: "diary", billingOn: true })).toBe(false);
    expect(featureAllowed({ plan: "FREE", feature: "cis", billingOn: true })).toBe(false);
    expect(featureAllowed({ plan: "SPLITSTICK", feature: "cis", billingOn: true })).toBe(true);
    expect(featureAllowed({ plan: "SPLITSTICK", feature: "diary", billingOn: true })).toBe(true);
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

describe("stripe webhook signatures", () => {
  const stripe = new Stripe("sk_test_x");
  const secrets = ["whsec_platform", "whsec_connect"];
  const connectPayload = JSON.stringify({
    id: "evt_connect",
    object: "event",
    type: "checkout.session.completed",
    account: "acct_trader",
    data: {
      object: {
        id: "cs_invoice",
        object: "checkout.session",
        mode: "payment",
        payment_status: "paid",
        metadata: { invoiceId: "inv_1" },
      },
    },
  });
  const planPayload = JSON.stringify({
    id: "evt_plan",
    object: "event",
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_plan",
        object: "checkout.session",
        mode: "subscription",
        payment_status: "paid",
        metadata: { traderId: "trader_1" },
      },
    },
  });

  function header(payload: string, secret: string) {
    return stripe.webhooks.generateTestHeaderString({ payload, secret });
  }

  it("accepts the platform secret and the connect secret", () => {
    expect(stripeWebhookSecrets({ STRIPE_WEBHOOK_SECRET: " whsec_platform ", STRIPE_CONNECT_WEBHOOK_SECRET: "whsec_connect" })).toEqual(secrets);
    const platformEvent = constructStripeEvent(stripe, planPayload, header(planPayload, "whsec_platform"), secrets);
    expect(platformEvent.account).toBeUndefined();
    expect(stripeEventKind(platformEvent)).toBe("subscription_checkout");
    const connectEvent = constructStripeEvent(stripe, connectPayload, header(connectPayload, "whsec_connect"), secrets);
    expect(connectEvent.account).toBe("acct_trader");
    expect(stripeEventKind(connectEvent)).toBe("connected_payment");
  });

  it("rejects a signature from neither secret", () => {
    expect(() => constructStripeEvent(stripe, connectPayload, header(connectPayload, "whsec_other"), secrets)).toThrow();
    expect(stripeWebhookSecrets({ STRIPE_WEBHOOK_SECRET: "  ", STRIPE_CONNECT_WEBHOOK_SECRET: "" })).toEqual([]);
  });
});

describe("accounts v2", () => {
  it("creates a UK Express merchant the generally available API accepts", () => {
    expect(expressAccountCreateParams({
      email: "trader@example.com",
      traderId: "trader_1",
      businessName: "Harbour Heating",
    })).toEqual({
      contact_email: "trader@example.com",
      dashboard: "express",
      display_name: "Harbour Heating",
      identity: { country: "gb" },
      configuration: {
        merchant: {
          capabilities: {
            card_payments: { requested: true },
          },
        },
      },
      defaults: {
        currency: "gbp",
        locales: ["en-GB"],
        responsibilities: {
          fees_collector: "application",
          losses_collector: "application",
        },
      },
      metadata: { traderId: "trader_1" },
      include: ["configuration.merchant", "requirements", "identity"],
    });
    const link = accountLinkParams({
      accountId: "acct_v2",
      refreshUrl: "https://example.test/business?stripe=refresh",
      returnUrl: "https://example.test/business?stripe=return",
      purpose: "onboarding",
    });
    expect(link.use_case.type).toBe("account_onboarding");
    expect(link.use_case.account_onboarding?.refresh_url).toContain("stripe=refresh");
    expect(link.use_case.account_onboarding?.return_url).toContain("stripe=return");
  });

  it("maps card, payout and details status from a v2 account", () => {
    const due = connectFlagsFromV2Account({
      configuration: { merchant: { capabilities: { card_payments: { status: "pending" }, stripe_balance: { payouts: { status: "pending" } } } } },
      requirements: {
        summary: { minimum_deadline: { status: "currently_due" } },
        entries: [{ awaiting_action_from: "user", minimum_deadline: { status: "currently_due" } }],
      },
    });
    expect(due).toEqual({ chargesEnabled: false, detailsSubmitted: false, payoutsEnabled: false });

    const reviewing = connectFlagsFromV2Account({
      configuration: { merchant: { capabilities: { card_payments: { status: "pending" }, stripe_balance: { payouts: { status: "pending" } } } } },
      requirements: { entries: [], summary: { minimum_deadline: { status: "eventually_due" } } },
    });
    expect(reviewing).toEqual({ chargesEnabled: false, detailsSubmitted: true, payoutsEnabled: false });

    const ready = connectFlagsFromV2Account({
      configuration: { merchant: { capabilities: { card_payments: { status: "active" }, stripe_balance: { payouts: { status: "active" } } } } },
      requirements: { entries: [] },
    });
    expect(ready).toEqual({ chargesEnabled: true, detailsSubmitted: true, payoutsEnabled: true });
  });

  it("accepts a thin account event and rejects a bad signature", () => {
    const stripe = new Stripe("sk_test_x");
    const secret = "whsec_v2_accounts";
    const payload = JSON.stringify({
      id: "evt_thin",
      object: "v2.core.event",
      type: "v2.core.account[configuration.merchant].capability_status_updated",
      created: "2026-10-25T00:00:00.000Z",
      livemode: false,
      related_object: { id: "acct_v2", type: "v2.core.account", url: "/v2/core/accounts/acct_v2" },
    });
    const header = stripe.webhooks.generateTestHeaderString({ payload, secret });
    expect(isThinEventPayload(payload)).toBe(true);
    const notification = stripe.parseEventNotification(payload, header, secret);
    expect(accountIdFromThinNotification(notification)).toBe("acct_v2");
    expect(() => stripe.parseEventNotification(payload, header, "whsec_other")).toThrow();
    expect(accountIdFromThinNotification({ type: "v2.core.event_destination.ping", related_object: { id: "acct_v2" } })).toBeNull();
    expect(stripeEventKind({ type: "account.updated", data: { object: { id: "acct_v2" } } } as Stripe.Event)).toBe("connect_account");
  });

  it("shows a short Stripe reason and removes secrets", () => {
    const error = new Error("Stripe no longer recommends Accounts v1. Key sk_test_abc123 whsec_secretvalue");
    const reason = publicStripeReason(error);
    expect(reason).toContain("Stripe no longer recommends Accounts v1");
    expect(reason).not.toContain("sk_test_abc123");
    expect(reason).not.toContain("whsec_secretvalue");
    expect(publicStripeReason(new Error(""))).toBe("Stripe could not open the Connect page. No payment was taken.");
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
