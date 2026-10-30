import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { invoiceSubscriptionIds } from "@/lib/billing/invoice-event";
import { subscriptionRecord } from "@/lib/billing/plans";
import { prisma } from "@/lib/db";
import { paidInvoicePatch } from "@/lib/payments/checkout";
import { subscriptionPriceId, syncConnectAccountByStripeId } from "@/lib/payments/connect";
import { accountIdFromThinNotification, isThinEventPayload, stripeV2AccountWebhookSecret } from "@/lib/payments/connect-account";
import { acceptsBillingEvent, constructStripeEvent, stripeEventKind, stripeWebhookSecrets } from "@/lib/payments/webhook";
import { stripeClient } from "@/lib/stripe";

export async function POST(request: Request) {
  const stripe = stripeClient();
  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  const body = await request.text();
  if (!stripe) return NextResponse.json({ error: "Stripe is not configured" }, { status: 501 });

  if (isThinEventPayload(body)) {
    return recordThinAccountEvent(stripe, body, signature);
  }

  const secrets = stripeWebhookSecrets(process.env);
  if (secrets.length === 0) {
    return NextResponse.json({ error: "Stripe is not configured" }, { status: 501 });
  }
  let event: Stripe.Event;
  try {
    event = constructStripeEvent(stripe, body, signature, secrets);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    const kind = stripeEventKind(event);
    if (!acceptsBillingEvent(kind, event.livemode)) {
      return NextResponse.json({ received: true });
    }
    if (kind === "subscription_checkout") {
      await recordSubscriptionCheckout(stripe, event.data.object as Stripe.Checkout.Session);
    } else if (kind === "connected_payment" || kind === "platform_payment") {
      await recordStripePayment(event.data.object as Stripe.Checkout.Session);
    } else if (kind === "subscription") {
      await recordSubscription(event.data.object as Stripe.Subscription);
    } else if (kind === "subscription_payment_failed") {
      await recordPaymentFailed(event.data.object as Stripe.Invoice);
    } else if (kind === "connect_account") {
      const account = event.data.object as { id?: string };
      if (account.id) await syncConnectAccountByStripeId(account.id);
    }
  } catch (error) {
    console.error("[stripe webhook]", error);
    return NextResponse.json({ error: "Could not record the Stripe event" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function recordThinAccountEvent(stripe: NonNullable<ReturnType<typeof stripeClient>>, body: string, signature: string) {
  const secret = stripeV2AccountWebhookSecret(process.env);
  if (!secret) return NextResponse.json({ error: "Stripe is not configured" }, { status: 501 });
  let accountId: string | null;
  try {
    accountId = accountIdFromThinNotification(stripe.parseEventNotification(body, signature, secret));
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }
  if (!accountId) return NextResponse.json({ received: true });
  try {
    await syncConnectAccountByStripeId(accountId);
  } catch (error) {
    console.error("[stripe account event]", error);
    return NextResponse.json({ error: "Could not record the Stripe event" }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}

async function recordSubscriptionCheckout(stripe: Stripe, session: Stripe.Checkout.Session) {
  const customerId = typeof session.customer === "string" ? session.customer : null;
  const traderId = session.metadata?.traderId || null;
  let status = "active";
  let priceId: string | null = null;
  let subscriptionId: string | null = null;
  let cancelAtPeriodEnd = false;
  let cancelAt: number | null = null;
  if (typeof session.subscription === "string") {
    subscriptionId = session.subscription;
    const subscription = await stripe.subscriptions.retrieve(session.subscription);
    status = subscription.status;
    priceId = subscriptionPriceId(subscription);
    cancelAtPeriodEnd = subscription.cancel_at_period_end;
    cancelAt = subscription.cancel_at;
  }
  await savePlan({ traderId, customerId, subscriptionId, status, priceId, cancelAtPeriodEnd, cancelAt });
}

async function recordSubscription(subscription: Stripe.Subscription) {
  const customerId = typeof subscription.customer === "string" ? subscription.customer : null;
  await savePlan({
    traderId: subscription.metadata?.traderId || null,
    customerId,
    subscriptionId: subscription.id,
    status: subscription.status,
    priceId: subscriptionPriceId(subscription),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    cancelAt: subscription.cancel_at,
  });
}

async function recordPaymentFailed(invoice: Stripe.Invoice) {
  const ids = invoiceSubscriptionIds(invoice);
  if (!ids.customerId && !ids.subscriptionId) return;
  await prisma.trader.updateMany({
    where: {
      OR: [
        ...(ids.customerId ? [{ stripeCustomerId: ids.customerId }] : []),
        ...(ids.subscriptionId ? [{ stripeSubscriptionId: ids.subscriptionId }] : []),
      ],
    },
    data: {
      subscriptionStatus: "past_due",
      ...(ids.subscriptionId ? { stripeSubscriptionId: ids.subscriptionId } : {}),
    },
  });
}

async function savePlan(input: {
  traderId: string | null;
  customerId: string | null;
  subscriptionId: string | null;
  status: string;
  priceId: string | null;
  cancelAtPeriodEnd?: boolean | null;
  cancelAt?: number | null;
}) {
  const next = subscriptionRecord(input);
  const data = {
    plan: next.plan,
    subscriptionStatus: next.subscriptionStatus,
    subscriptionPriceId: next.subscriptionPriceId,
    legacyUnlimited: next.legacyUnlimited,
    subscriptionCancelAtPeriodEnd: next.subscriptionCancelAtPeriodEnd,
    subscriptionCancelAt: next.subscriptionCancelAt,
    ...(input.customerId ? { stripeCustomerId: input.customerId } : {}),
    ...(input.subscriptionId ? { stripeSubscriptionId: input.subscriptionId } : {}),
  };
  if (input.traderId) {
    await prisma.trader.updateMany({ where: { id: input.traderId }, data });
    return;
  }
  if (input.customerId) {
    await prisma.trader.updateMany({ where: { stripeCustomerId: input.customerId }, data });
  }
}

async function recordStripePayment(session: Stripe.Checkout.Session) {
  const now = new Date();
  const paymentLinkId = typeof session.payment_link === "string" ? session.payment_link : null;
  const invoiceId = session.metadata?.invoiceId;
  if (invoiceId || paymentLinkId) {
    const invoice = await prisma.invoice.findFirst({
      where: invoiceId ? { id: invoiceId } : { stripePaymentLinkId: paymentLinkId ?? "" },
    });
    const patch = invoice ? paidInvoicePatch(invoice, now) : null;
    if (invoice && patch) {
      await prisma.invoice.update({ where: { id: invoice.id }, data: patch });
      await prisma.invoiceEvent.create({
        data: {
          invoiceId: invoice.id,
          type: "paid",
          channel: "web",
          detail: "Stripe payment completed. Payment reminders have stopped.",
        },
      });
      return;
    }
    if (invoice) return;
  }

  const quoteId = session.metadata?.quoteId;
  const quote = await prisma.quote.findFirst({
    where: quoteId ? { id: quoteId } : paymentLinkId ? { stripePaymentLinkId: paymentLinkId } : { id: "" },
  });
  if (!quote || quote.depositPaidAt) return;
  await prisma.quote.update({
    where: { id: quote.id },
    data: { depositPaidAt: now, stripeSessionId: session.id },
  });
  await prisma.quoteEvent.create({
    data: { quoteId: quote.id, type: "deposit_paid", channel: "web", detail: "Stripe payment completed." },
  });
}
