import { prisma } from "@/lib/db";
import { hashToken, newToken } from "@/lib/auth";
import { customerEmail, formatGBP, quoteTotals } from "@/lib/format";
import { deliver } from "@/lib/channels";
import { createEnquiryAndDraft } from "@/lib/enquiries/create-draft";
import { createDraftInvoice, approveInvoice } from "@/lib/invoices/store";
import { parseInvoiceText } from "@/lib/invoices/parse";
import { renderInvoicePdf } from "@/lib/invoices/pdf";
import { billingConfigured, featureAllowed, sendBlockReason, upgradeMessage } from "@/lib/billing/plans";
import { isSandboxTrader } from "@/lib/sandbox";
import { approveDraft, deliveryForCustomer } from "@/lib/quotes/approval";
import { sendWhatsAppDocument, sendWhatsAppText, whatsappConfigured } from "@/lib/whatsapp/client";
import { interpretInbound, normaliseWhatsAppNumber } from "@/lib/whatsapp/interpret";
import { draftInvoiceReply, draftQuoteReply, paymentNote } from "@/lib/whatsapp/plan";

function appOrigin(): string {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

async function remember(phone: string, traderId: string | null, direction: "in" | "out", body: string) {
  await prisma.whatsAppMessage.create({
    data: { phone, traderId, direction, body: body.slice(0, 4000) },
  });
}

async function reply(phone: string, traderId: string | null, text: string, viaMeta: boolean, sandbox = false): Promise<string> {
  await remember(phone, traderId, "out", text);
  if (viaMeta && whatsappConfigured() && !sandbox) {
    try {
      await sendWhatsAppText(phone, text);
    } catch (error) {
      console.error("[whatsapp send]", error);
    }
  }
  return text;
}

export async function handleInboundWhatsApp(input: {
  from: string;
  text: string;
  viaMeta: boolean;
  externalId?: string;
}): Promise<string[]> {
  const phone = normaliseWhatsAppNumber(input.from) ?? input.from.replace(/\D/g, "");
  if (!phone) return [];
  if (input.externalId) {
    try {
      await prisma.whatsAppReceipt.create({ data: { id: input.externalId } });
    } catch {
      return [];
    }
  }

  const intent = interpretInbound(input.text);
  const linked = await prisma.trader.findUnique({ where: { whatsappE164: phone }, include: { user: true } });
  const sandbox = isSandboxTrader({ slug: linked?.slug, email: linked?.user.email });
  await remember(phone, linked?.id ?? null, "in", input.text);
  const origin = appOrigin();
  const replies: string[] = [];

  if (intent.type === "empty") {
    replies.push(await reply(phone, linked?.id ?? null, "Send a job description, or an invoice such as: Invoice Mrs Jones, replaced tap, £80", input.viaMeta, sandbox));
    return replies;
  }

  if (intent.type === "link") {
    const trader = await prisma.trader.findFirst({
      where: { whatsappLinkCodeHash: hashToken(intent.code), whatsappLinkExpiresAt: { gt: new Date() } },
    });
    if (!trader) {
      replies.push(await reply(phone, null, "That link code is not valid or it has expired. Create a new one in Quotestick, under Your page.", input.viaMeta));
      return replies;
    }
    const linkSandbox = isSandboxTrader({ slug: trader.slug });
    if (!featureAllowed({ plan: trader.plan, feature: "whatsapp", sandbox: linkSandbox, billingOn: billingConfigured() })) {
      replies.push(await reply(phone, trader.id, upgradeMessage("whatsapp"), input.viaMeta, linkSandbox));
      return replies;
    }
    const taken = await prisma.trader.findUnique({ where: { whatsappE164: phone } });
    if (taken && taken.id !== trader.id) {
      replies.push(await reply(phone, trader.id, "This WhatsApp number is already linked to another Quotestick account.", input.viaMeta, linkSandbox));
      return replies;
    }
    await prisma.trader.update({
      where: { id: trader.id },
      data: { whatsappE164: phone, whatsappLinkCodeHash: null, whatsappLinkExpiresAt: null },
    });
    replies.push(
      await reply(
        phone,
        trader.id,
        `Linked to ${trader.businessName}. Send a job for a draft quote, or send: Invoice Mrs Jones, replaced tap, £80`,
        input.viaMeta,
        linkSandbox,
      ),
    );
    return replies;
  }

  if (linked && !featureAllowed({ plan: linked.plan, feature: "whatsapp", sandbox, billingOn: billingConfigured() })) {
    replies.push(await reply(phone, linked.id, upgradeMessage("whatsapp"), input.viaMeta, sandbox));
    return replies;
  }

  if (!linked) {
    replies.push(
      await reply(
        phone,
        null,
        "This number is not linked to a Quotestick account. Open Your page, create a link code, then send LINK and the code.",
        input.viaMeta,
      ),
    );
    return replies;
  }

  if (intent.type === "approve") {
    const text = await approveForTrader(linked.id, intent.number, origin);
    replies.push(await reply(phone, linked.id, text, input.viaMeta, sandbox));
    return replies;
  }

  if (intent.type === "invoice") {
    const parsed = parseInvoiceText(intent.raw);
    if (!parsed.ok) {
      replies.push(await reply(phone, linked.id, parsed.error, input.viaMeta, sandbox));
      return replies;
    }
    const invoice = await createDraftInvoice({ traderId: linked.id, parsed: parsed.data, source: "whatsapp" });
    const planned = draftInvoiceReply({
      number: invoice.number,
      customerName: invoice.customerName,
      summary: `${invoice.description}. ${formatGBP(invoice.totalPence)}. Due ${invoice.dueAt.toISOString().slice(0, 10)}.`,
      traderUrl: `${origin}/invoices/${invoice.id}`,
    });
    replies.push(await reply(phone, linked.id, planned.traderText, input.viaMeta, sandbox));
    if (input.viaMeta && whatsappConfigured() && !sandbox) {
      try {
        const pdf = await renderInvoicePdf({ ...invoice, issuedAt: invoice.createdAt, paymentUrl: null });
        await sendWhatsAppDocument(phone, pdf, `${invoice.number}.pdf`, "Draft invoice. Not sent to the customer.");
      } catch (error) {
        console.error("[whatsapp pdf]", error);
      }
    }
    return replies;
  }

  const created = await createEnquiryAndDraft({
    traderId: linked.id,
    customerName: "Customer",
    contact: "",
    postcode: "Not given",
    jobDescription: intent.text,
    source: "whatsapp",
    photos: [],
    origin,
  });
  const planned = draftQuoteReply({
    number: created.number,
    summary: intent.text.slice(0, 280),
    traderUrl: `${origin}/quotes/${created.quoteId}`,
  });
  replies.push(await reply(phone, linked.id, planned.traderText, input.viaMeta, sandbox));
  return replies;
}

async function approveForTrader(traderId: string, number: string | null, origin: string): Promise<string> {
  if (number?.startsWith("I-")) {
    const invoice = await prisma.invoice.findFirst({ where: { traderId, number } });
    if (!invoice) return `There is no invoice ${number} on your account.`;
    if (invoice.status !== "DRAFT") return `${number} is already ${invoice.status.toLowerCase()}. Nothing new was sent.`;
    let approved: Awaited<ReturnType<typeof approveInvoice>>;
    try {
      approved = await approveInvoice(invoice.id, traderId, origin);
    } catch (error) {
      return error instanceof Error ? error.message : "That invoice could not be approved. Nothing was sent.";
    }
    if (!approved) return "That invoice could not be approved.";
    return [
      `Invoice ${invoice.number} is approved.`,
      `Customer link: ${approved.customerUrl}`,
      approved.note,
      approved.customerDetail,
    ].join("\n");
  }

  if (number?.startsWith("Q-")) {
    return approveQuote(traderId, number, origin);
  }

  const [latestInvoice, latestQuote] = await Promise.all([
    prisma.invoice.findFirst({ where: { traderId, status: "DRAFT" }, orderBy: { createdAt: "desc" } }),
    prisma.quote.findFirst({ where: { traderId, status: "DRAFT" }, orderBy: { createdAt: "desc" } }),
  ]);
  if (!latestInvoice && !latestQuote) return "There is no draft waiting. Nothing was sent to a customer.";
  const invoiceNewer = latestInvoice && (!latestQuote || latestInvoice.createdAt >= latestQuote.createdAt);
  if (invoiceNewer && latestInvoice) return approveForTrader(traderId, latestInvoice.number, origin);
  if (latestQuote) return approveQuote(traderId, latestQuote.number, origin);
  return "There is no draft waiting.";
}

async function approveQuote(traderId: string, number: string, origin: string): Promise<string> {
  const quote = await prisma.quote.findFirst({
    where: { traderId, number },
    include: { lines: true, trader: { include: { user: true } } },
  });
  if (!quote) return `There is no quote ${number} on your account.`;
  if (quote.status !== "DRAFT") return `${number} is already ${quote.status.toLowerCase()}. Nothing new was sent.`;
  const next = approveDraft(quote.status);
  const totals = quoteTotals(
    quote.lines.map((line) => ({
      kind: line.kind,
      quantity: Number(line.quantity),
      unitPricePence: line.unitPricePence,
    })),
    quote.depositPercent,
  );
  const sandbox = isSandboxTrader({ slug: quote.trader.slug, email: quote.trader.user.email });
  const blocked = sendBlockReason({ emailVerifiedAt: quote.trader.user.emailVerifiedAt, sandbox });
  if (blocked) return blocked;
  const now = new Date();
  await prisma.quote.update({
    where: { id: quote.id },
    data: {
      status: next,
      approvedAt: now,
      sentAt: now,
      reviewToken: quote.reviewToken ?? newToken(),
    },
  });
  const released = deliveryForCustomer(next, quote.publicToken);
  const customerUrl = `${origin}${released.path}`;
  const note = paymentNote(totals.deposit > 0 ? quote.stripePaymentUrl : null);
  const email = customerEmail(quote.customerContact);
  let detail = "Approved. No email address on the quote, so the customer was not emailed.";
  if (email) {
    const result = await deliver({
      channel: "email",
      to: email,
      subject: `Quote ${quote.number} from ${quote.trader.businessName}`,
      text: [`${quote.trader.businessName} has sent you quote ${quote.number}.`, "", customerUrl, note].join("\n"),
      sandbox,
    });
    detail = result.stubbed
      ? "Approved. The customer link is live. Email was logged, not sent (no SMTP configured)."
      : "Approved. The customer link is live and the email was sent.";
  }
  await prisma.quoteEvent.create({
    data: { quoteId: quote.id, type: "approved", channel: email ? "email" : "whatsapp", detail },
  });
  return [`Quote ${quote.number} is approved.`, `Customer link: ${customerUrl}`, note, detail].join("\n");
}
