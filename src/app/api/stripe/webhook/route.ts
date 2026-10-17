import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { prisma } from "@/lib/db";
import { stripeClient } from "@/lib/stripe";

export async function POST(request: Request) {
  const stripe = stripeClient();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) {
    return NextResponse.json({ error: "Stripe is not configured" }, { status: 501 });
  }
  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  const body = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, secret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.payment_status === "paid") {
      try {
        await recordStripePayment(session);
      } catch (error) {
        console.error("[stripe webhook]", error);
        return NextResponse.json({ error: "Could not record payment" }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ received: true });
}

async function recordStripePayment(session: Stripe.Checkout.Session) {
  const now = new Date();
  const paymentLinkId = typeof session.payment_link === "string" ? session.payment_link : null;
  const invoiceId = session.metadata?.invoiceId;
  if (invoiceId || paymentLinkId) {
    const invoice = await prisma.invoice.findFirst({
      where: invoiceId ? { id: invoiceId } : { stripePaymentLinkId: paymentLinkId ?? "" },
    });
    if (invoice && !invoice.paidAt && invoice.status !== "DRAFT") {
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: { status: "PAID", paidAt: now, jobCompletedAt: invoice.jobCompletedAt ?? now },
      });
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
