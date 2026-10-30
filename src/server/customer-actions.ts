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
import { isNextRedirect, redirectWith } from "@/lib/redirects";
import { billingConfigured, type PlanName } from "@/lib/billing/plans";
import { connectedCheckoutArgs } from "@/lib/payments/checkout";
import { cardButtonVisible } from "@/lib/payments/connect-status";
import { platformFeePence } from "@/lib/payments/fee";
import { isSandboxTrader } from "@/lib/sandbox";
import { stripeClient, stripeConfigured } from "@/lib/stripe";
import { isQuoteExpired } from "@/lib/chasers/plan";
import { expireQuoteNow, stopQuoteChases } from "@/lib/chasers/queue";
import { ensureBookedJob } from "@/lib/jobs/ensure";

async function loadVisible(token: string) {
  const quote = await prisma.quote.findUnique({
    where: { publicToken: token },
    include: { lines: { orderBy: { sortOrder: "asc" } }, trader: true },
  });
  return resolvePublicQuoteView(quote);
}

async function refuseIfExpired(token: string, quote: { id: string; status: string; expiresAt: Date | null }) {
  const now = new Date();
  if (quote.status !== "EXPIRED" && !isQuoteExpired(quote, now)) return;
  if (quote.status === "SENT") await expireQuoteNow(quote.id, now);
  redirectWith(`/q/${token}`, "error", "This quote has expired.");
}

export async function acceptQuote(formData: FormData) {
  const token = String(formData.get("token") || "");
  const quote = await loadVisible(token);
  if (!quote) redirectWith(`/q/${token}`, "error", "This quote is not available.");
  await refuseIfExpired(token, quote);
  try {
    acceptSentQuote(quote.status);
  } catch (error) {
    redirectWith(`/q/${token}`, "error", error instanceof Error ? error.message : "This quote cannot be accepted.");
  }
  await prisma.quote.update({
    where: { id: quote.id },
    data: { status: "ACCEPTED", acceptedAt: new Date() },
  });
  try {
    await ensureBookedJob(prisma, quote.id);
  } catch (error) {
    console.error("[job]", error);
  }
  await stopQuoteChases(quote.id, "Customer accepted. Follow-ups stopped.");
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
        sandbox: isSandboxTrader({ slug: trader.slug, email: trader.user.email }),
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
  await refuseIfExpired(token, quote);
  try {
    declineSentQuote(quote.status);
  } catch (error) {
    redirectWith(`/q/${token}`, "error", error instanceof Error ? error.message : "This quote cannot be declined.");
  }
  await prisma.quote.update({
    where: { id: quote.id },
    data: { status: "DECLINED", declinedAt: new Date() },
  });
  await stopQuoteChases(quote.id, "Customer declined. Follow-ups stopped.");
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
  await openConnectedCheckout({
    path: `/q/${token}`,
    amountPence: totals.deposit,
    name: `Deposit for quote ${quote.number}`,
    description: quote.trader.businessName,
    metadata: { quoteId: quote.id },
    customerEmail: customerEmail(quote.customerContact),
    trader: quote.trader,
    successPath: `/q/${token}?deposit=pending`,
    cancelPath: `/q/${token}?deposit=cancelled`,
    remember: async (sessionId) => {
      await prisma.quote.update({ where: { id: quote.id }, data: { stripeSessionId: sessionId } });
    },
  });
}

export async function startInvoicePayment(formData: FormData) {
  const token = String(formData.get("token") || "");
  const invoice = await prisma.invoice.findUnique({
    where: { publicToken: token },
    include: { trader: true },
  });
  if (!invoice || invoice.status === "DRAFT") {
    redirectWith(`/i/${token}`, "error", "This invoice is not available.");
  }
  if (invoice.paidAt || invoice.status === "PAID") redirect(`/i/${token}`);
  if (invoice.totalPence <= 0) {
    redirectWith(`/i/${token}`, "notice", "There is nothing to pay on this invoice.");
  }
  await openConnectedCheckout({
    path: `/i/${token}`,
    amountPence: invoice.totalPence,
    name: `Invoice ${invoice.number}`,
    description: invoice.businessName,
    metadata: { invoiceId: invoice.id },
    customerEmail: customerEmail(invoice.customerContact),
    trader: invoice.trader,
    successPath: `/i/${token}?paid=pending`,
    cancelPath: `/i/${token}?paid=cancelled`,
    remember: async (sessionId) => {
      await prisma.invoiceEvent.create({
        data: {
          invoiceId: invoice.id,
          type: "pay_opened",
          channel: "web",
          detail: `Card payment page opened (${sessionId}).`,
        },
      });
    },
  });
}

async function openConnectedCheckout(input: {
  path: string;
  amountPence: number;
  name: string;
  description: string;
  metadata: Record<string, string>;
  customerEmail: string | null;
  trader: {
    slug: string;
    plan: PlanName;
    stripeAccountId: string | null;
    stripeChargesEnabled: boolean;
  };
  successPath: string;
  cancelPath: string;
  remember: (sessionId: string) => Promise<void>;
}) {
  const sandbox = isSandboxTrader({ slug: input.trader.slug });
  const visible = cardButtonVisible({
    stripeConfigured: stripeConfigured(),
    sandbox,
    stripeAccountId: input.trader.stripeAccountId,
    stripeChargesEnabled: input.trader.stripeChargesEnabled,
    plan: input.trader.plan,
    billingOn: billingConfigured(),
  });
  if (sandbox || !visible || !input.trader.stripeAccountId) {
    redirectWith(input.path, "notice", "Card payments are not switched on. No payment has been taken.");
  }
  if (input.amountPence < 30) {
    redirectWith(input.path, "notice", "That amount is too small for a card payment. No payment has been taken.");
  }
  const stripe = stripeClient();
  if (!stripe) {
    redirectWith(input.path, "notice", "Card payments are not switched on. No payment has been taken.");
  }
  const origin = await requestOrigin();
  const args = connectedCheckoutArgs({
    name: input.name,
    description: input.description,
    amountPence: input.amountPence,
    metadata: input.metadata,
    customerEmail: input.customerEmail,
    successUrl: `${origin}${input.successPath}`,
    cancelUrl: `${origin}${input.cancelPath}`,
    stripeAccountId: input.trader.stripeAccountId,
    feePence: platformFeePence(input.amountPence),
  });
  try {
    const session = await stripe.checkout.sessions.create(args.params, args.options);
    await input.remember(session.id);
    if (!session.url) {
      redirectWith(input.path, "error", "The card payment page could not be opened. No payment has been taken.");
    }
    redirect(session.url);
  } catch (error) {
    if (isNextRedirect(error)) throw error;
    console.error("[stripe]", error);
    redirectWith(input.path, "error", "The card payment page could not be opened. No payment has been taken.");
  }
}
