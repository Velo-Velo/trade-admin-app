"use server";

import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { deliver } from "@/lib/channels";
import { customerEmail, parseQuantity, poundsToPence, quoteTotals } from "@/lib/format";
import { newToken } from "@/lib/auth";
import { createGbpPaymentLink } from "@/lib/payments/link";
import { paymentNote } from "@/lib/whatsapp/plan";
import { requestOrigin } from "@/lib/origin";
import { approveDraft, deliveryForCustomer, validateQuoteLines, type QuoteLineInput } from "@/lib/quotes/approval";
import { coolingOffFor } from "@/lib/quotes/cooling-off";
import { redirectWith } from "@/lib/redirects";

type RawLine = {
  kind?: string;
  description?: string;
  quantity?: string;
  unit?: string;
  unitPrice?: string;
  priceBookItemId?: string | null;
  lastPaidPence?: number | null;
};

function parseLines(raw: string): QuoteLineInput[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;
  const lines: QuoteLineInput[] = [];
  for (const entry of parsed as RawLine[]) {
    const quantity = parseQuantity(String(entry.quantity ?? ""));
    const unitPricePence = poundsToPence(String(entry.unitPrice ?? ""));
    if (quantity === null || unitPricePence === null) return null;
    if (entry.kind !== "LABOUR" && entry.kind !== "MATERIAL") return null;
    lines.push({
      kind: entry.kind,
      description: String(entry.description ?? ""),
      quantity,
      unit: String(entry.unit ?? ""),
      unitPricePence,
      priceBookItemId: entry.priceBookItemId || null,
      lastPaidPence: typeof entry.lastPaidPence === "number" ? entry.lastPaidPence : null,
    });
  }
  return lines;
}

export async function saveQuoteAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user?.trader) redirectWith("/login", "error", "Sign in to continue.");
  const quoteId = String(formData.get("quoteId") || "");
  const intent = String(formData.get("intent") || "save");
  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, traderId: user.trader.id },
  });
  if (!quote) redirectWith("/quotes", "error", "That quote could not be found.");
  if (quote.status !== "DRAFT") {
    redirectWith(`/quotes/${quote.id}`, "error", "This quote has already been sent and can no longer be edited.");
  }

  const lines = parseLines(String(formData.get("lines") || ""));
  if (!lines) redirectWith(`/quotes/${quote.id}`, "error", "Check the quantities and prices. Use pounds and pence, such as 12.50.");
  const depositPercent = Number(formData.get("depositPercent"));
  const domestic = formData.get("domestic") === "on";
  const problem = validateQuoteLines(lines, depositPercent);
  if (problem) redirectWith(`/quotes/${quote.id}`, "error", problem);

  const approving = intent === "approve";
  const nextStatus = approving ? approveDraft(quote.status) : quote.status;
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.quoteLine.deleteMany({ where: { quoteId: quote.id } });
    await tx.quoteLine.createMany({
      data: lines.map((line, index) => ({
        quoteId: quote.id,
        kind: line.kind,
        description: line.description.trim(),
        quantity: line.quantity,
        unit: line.unit.trim(),
        unitPricePence: line.unitPricePence,
        priceBookItemId: line.priceBookItemId ?? null,
        lastPaidPence: line.lastPaidPence ?? null,
        sortOrder: index,
      })),
    });
    await tx.quote.update({
      where: { id: quote.id },
      data: {
        depositPercent,
        domestic,
        coolingOffText: coolingOffFor(domestic),
        ...(approving ? { status: nextStatus, approvedAt: now, sentAt: now } : {}),
      },
    });
    if (!approving) {
      await tx.quoteEvent.create({
        data: {
          quoteId: quote.id,
          type: "edited",
          channel: "web",
          detail: "Draft saved. Not sent to the customer.",
        },
      });
    }
  });

  if (!approving) {
    redirectWith(`/quotes/${quote.id}`, "notice", "Draft saved. The customer still cannot open it.");
  }

  const release = deliveryForCustomer(nextStatus, quote.publicToken);
  const origin = await requestOrigin();
  const url = `${origin}${release.path}`;
  const totals = quoteTotals(
    lines.map((line) => ({ kind: line.kind, quantity: line.quantity, unitPricePence: line.unitPricePence })),
    depositPercent,
  );
  const pay = await createGbpPaymentLink({
    name: `Deposit for quote ${quote.number}`,
    amountPence: totals.deposit,
    metadata: { quoteId: quote.id },
  });
  await prisma.quote.update({
    where: { id: quote.id },
    data: {
      stripePaymentLinkId: pay.id,
      stripePaymentUrl: pay.url,
      reviewToken: quote.reviewToken ?? newToken(),
    },
  });
  const note = paymentNote(totals.deposit > 0 ? pay.url : null);
  const email = customerEmail(quote.customerContact);
  let detail: string;
  if (!email) {
    detail = "Approved. No email address on the enquiry, so nothing was emailed. Share the link yourself. WhatsApp is not connected.";
  } else {
    try {
      const result = await deliver({
        channel: "email",
        to: email,
        subject: `Quote ${quote.number} from ${user.trader.businessName}`,
        text: [
          `${user.trader.businessName} has sent you a quote (${quote.number}).`,
          "",
          `View it here: ${url}`,
          "",
          "Nothing is booked until you accept. A deposit, if there is one, is a separate step.",
          note,
          "",
          `This was sent because you asked ${user.trader.businessName} about a job.`,
        ].join("\n"),
      });
      detail = result.stubbed
        ? "Approved. The customer link is live. Email was logged, not sent (no SMTP configured)."
        : "Approved. The customer link is live and the email was sent.";
    } catch (error) {
      console.error("[quote email]", error);
      detail = "Approved and the link is live, but the email could not be sent. Share the link yourself.";
    }
  }

  await prisma.quoteEvent.create({
    data: { quoteId: quote.id, type: "approved", channel: email ? "email" : "web", detail },
  });
  redirectWith(`/quotes/${quote.id}`, "notice", detail);
}
