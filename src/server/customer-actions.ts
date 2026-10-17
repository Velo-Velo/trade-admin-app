"use server";

import { prisma } from "@/lib/db";
import { customerEmail, quoteTotals } from "@/lib/format";
import { requestOrigin } from "@/lib/origin";
import {
  acceptSentQuote,
  declineSentQuote,
  resolvePublicQuoteView,
} from "@/lib/quotes/approval";
import { redirect } from "next/navigation";
import { redirectWith } from "@/lib/redirects";
import { stripeClient } from "@/lib/stripe";

async function loadVisible(token: string) {
  const quote = await prisma.quote.findUnique({
    where: { publicToken: token },
    include: { lines: { orderBy: { sortOrder: "asc" } }, trader: true },
  });
  return resolvePublicQuoteView(quote);
}

export async function acceptQuote(formData: FormData) {
  const token = String(formData.get("token") || "");
  const quote = await loadVisible(token);
  if (!quote) redirectWith(`/q/${token}`, "error", "This quote is not available.");
  try {
    acceptSentQuote(quote.status);
  } catch (error) {
    redirectWith(`/q/${token}`, "error", error instanceof Error ? error.message : "This quote cannot be accepted.");
  }
  await prisma.quote.update({
    where: { id: quote.id },
    data: { status: "ACCEPTED", acceptedAt: new Date() },
  });
  await prisma.quoteEvent.create({
    data: {
      quoteId: quote.id,
      type: "customer_accepted",
      channel: "web",
      detail: "Customer accepted on the public quote page.",
    },
  });
  const trader = await prisma.trader.findUnique({
    where: { id: quote.traderId },
    include: { user: true },
  });
  if (trader) {
    const { deliver } = await import("@/lib/channels");
    const origin = await requestOrigin();
    try {
      await deliver({
        channel: "email",
        to: trader.user.email,
        subject: `${quote.customerName} accepted quote ${quote.number}`,
        text: `${quote.customerName} accepted quote ${quote.number}.\n\n${origin}/quotes/${quote.id}`,
      });
    } catch (error) {
      console.error("[accept email]", error);
    }
  }
  redirectWith(`/q/${token}`, "notice", "You have accepted this quote.");
}

export async function declineQuote(formData: FormData) {
  const token = String(formData.get("token") || "");
  const quote = await loadVisible(token);
  if (!quote) redirectWith(`/q/${token}`, "error", "This quote is not available.");
  try {
    declineSentQuote(quote.status);
  } catch (error) {
    redirectWith(`/q/${token}`, "error", error instanceof Error ? error.message : "This quote cannot be declined.");
  }
  await prisma.quote.update({
    where: { id: quote.id },
    data: { status: "DECLINED", declinedAt: new Date() },
  });
  await prisma.quoteEvent.create({
    data: {
      quoteId: quote.id,
      type: "customer_declined",
      channel: "web",
      detail: "Customer declined on the public quote page.",
    },
  });
  redirectWith(`/q/${token}`, "notice", "You have declined this quote.");
}

export async function startDeposit(formData: FormData) {
  const token = String(formData.get("token") || "");
  const quote = await loadVisible(token);
  if (!quote || quote.status !== "ACCEPTED") {
    redirectWith(`/q/${token}`, "error", "Accept the quote before paying a deposit.");
  }
  if (quote.depositPaidAt) redirect(`/q/${token}`);
  const totals = quoteTotals(
    quote.lines.map((line) => ({
      kind: line.kind,
      quantity: Number(line.quantity),
      unitPricePence: line.unitPricePence,
    })),
    quote.depositPercent,
  );
  if (totals.deposit <= 0) {
    redirectWith(`/q/${token}`, "notice", "This quote does not ask for a deposit.");
  }
  const stripe = stripeClient();
  if (!stripe) {
    redirectWith(
      `/q/${token}`,
      "notice",
      "Card payments are not switched on. No payment has been taken. The trader will arrange the deposit with you.",
    );
  }
  const origin = await requestOrigin();
  const email = customerEmail(quote.customerContact);
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: email ?? undefined,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "gbp",
            unit_amount: totals.deposit,
            product_data: {
              name: `Deposit for quote ${quote.number}`,
              description: quote.trader.businessName,
            },
          },
        },
      ],
      metadata: { quoteId: quote.id },
      success_url: `${origin}/q/${token}?deposit=pending`,
      cancel_url: `${origin}/q/${token}?deposit=cancelled`,
    });
    await prisma.quote.update({
      where: { id: quote.id },
      data: { stripeSessionId: session.id },
    });
    if (!session.url) {
      redirectWith(`/q/${token}`, "error", "The card payment page could not be opened.");
    }
    redirect(session.url);
  } catch (error) {
    console.error("[stripe]", error);
    redirectWith(`/q/${token}`, "error", "The card payment page could not be opened. No payment has been taken.");
  }
}
