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
    const quoteId = session.metadata?.quoteId;
    if (quoteId && session.payment_status === "paid") {
      try {
        await prisma.quote.update({
          where: { id: quoteId },
          data: { depositPaidAt: new Date(), stripeSessionId: session.id },
        });
        await prisma.quoteEvent.create({
          data: {
            quoteId,
            type: "deposit_paid",
            channel: "web",
            detail: "Stripe checkout completed.",
          },
        });
      } catch (error) {
        console.error("[stripe webhook]", error);
        return NextResponse.json({ error: "Could not record payment" }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ received: true });
}
