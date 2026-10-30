import { prisma } from "@/lib/db";
import { newToken } from "@/lib/auth";
import { findOrCreateCustomer } from "@/lib/customers/store";
import { soleUninvoicedJob } from "@/lib/jobs/board";
import { customerEmail } from "@/lib/format";
import { deliver } from "@/lib/channels";
import { billingConfigured, featureAllowed, sendBlockReason, upgradeMessage } from "@/lib/billing/plans";
import { isSandboxTrader } from "@/lib/sandbox";
import { approveInvoiceDraft, customerInvoicePath } from "@/lib/invoices/approval";
import { splitVat } from "@/lib/invoices/vat";
import type { ParsedInvoice } from "@/lib/invoices/parse";
import { paymentNote } from "@/lib/whatsapp/plan";
import { cisDeductionPence, suggestedCis } from "@/lib/cis/calc";

const DAY = 24 * 60 * 60 * 1000;

export async function createDraftInvoice(input: {
  traderId: string;
  parsed: ParsedInvoice;
  source: string;
}) {
  const trader = await prisma.trader.findUniqueOrThrow({ where: { id: input.traderId } });
  const amounts = splitVat(input.parsed.amountPence, trader.vatRegistered, input.parsed.vatExclusive);
  const dueAt = new Date(Date.now() + input.parsed.dueDays * DAY);
  return prisma.$transaction(async (tx) => {
    const updated = await tx.trader.update({
      where: { id: trader.id },
      data: { invoiceSeq: { increment: 1 } },
    });
    const number = `I-${String(updated.invoiceSeq).padStart(4, "0")}`;
    const customer = await findOrCreateCustomer(tx, {
      traderId: trader.id,
      name: input.parsed.customerName,
      contact: input.parsed.contact,
    });
    const suggestion = suggestedCis({
      traderStatus: trader.cisStatus,
      customerDeducts: customer.deductsCis,
      customerOverride: customer.cisRateOverride,
    });
    const allowCis = featureAllowed({
      plan: trader.plan,
      feature: "cis",
      sandbox: isSandboxTrader({ slug: trader.slug }),
      billingOn: billingConfigured(),
    });
    const applyCis = allowCis && suggestion.applies;
    const cisRate = applyCis ? suggestion.rate : 0;
    const deduction = applyCis ? cisDeductionPence(amounts.netPence, cisRate) : 0;
    const openJobs = await tx.job.findMany({
      where: { traderId: trader.id, customerId: customer.id },
      select: { id: true, invoiceId: true },
    });
    const attach = soleUninvoicedJob(openJobs);
    const invoice = await tx.invoice.create({
      data: {
        traderId: trader.id,
        customerId: customer.id,
        number,
        status: "DRAFT",
        customerName: input.parsed.customerName,
        customerContact: input.parsed.contact,
        description: input.parsed.description,
        netPence: amounts.netPence,
        vatPence: amounts.vatPence,
        totalPence: amounts.totalPence,
        vatRate: amounts.vatRate,
        labourPence: amounts.netPence,
        materialsPence: 0,
        cisApplies: applyCis,
        cisRate,
        cisDeductionPence: deduction,
        amountDuePence: amounts.totalPence - deduction,
        publicToken: newToken(),
        reviewToken: newToken(),
        dueAt,
        chaserEnabled: true,
        reviewChaserEnabled: trader.reviewChasersEnabled,
        source: input.source,
        businessName: trader.businessName,
        phone: trader.phone,
        tradingAddress: trader.tradingAddress,
        vatNumber: trader.vatRegistered ? trader.vatNumber : "",
        bankAccountName: trader.bankAccountName,
        bankSortCode: trader.bankSortCode,
        bankAccountNumber: trader.bankAccountNumber,
        events: {
          create: {
            type: "draft_created",
            channel: input.source,
            detail: applyCis
              ? "Draft invoice. A CIS deduction is recorded from the customer setting. Check the labour and materials before you approve. Not sent to the customer or to HMRC."
              : "Draft invoice. Not sent to the customer.",
          },
        },
      },
    });
    if (attach) {
      await tx.job.update({ where: { id: attach.id }, data: { invoiceId: invoice.id } });
    }
    return invoice;
  });
}

export async function approveInvoice(invoiceId: string, traderId: string, origin: string) {
  const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, traderId } });
  if (!invoice) return null;
  const trader = await prisma.trader.findUnique({ where: { id: traderId }, include: { user: true } });
  if (!trader) return null;
  const sandbox = isSandboxTrader({ slug: trader.slug, email: trader.user.email });
  if (!featureAllowed({ plan: trader.plan, feature: "invoices", sandbox, billingOn: billingConfigured() })) {
    throw new Error(upgradeMessage("invoices"));
  }
  const blocked = sendBlockReason({ emailVerifiedAt: trader.user.emailVerifiedAt, sandbox });
  if (blocked) throw new Error(blocked);
  const next = approveInvoiceDraft(invoice.status);
  const now = new Date();
  await prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      status: next,
      approvedAt: now,
      sentAt: now,
    },
  });
  const released = customerInvoicePath(next, invoice.publicToken);
  const customerUrl = `${origin}${released.path}`;
  const note = paymentNote(invoice.stripePaymentUrl);
  const email = customerEmail(invoice.customerContact);
  let customerDetail = "Approved. No email address on the invoice, so the customer was not emailed.";
  if (email) {
    const result = await deliver({
      channel: "email",
      to: email,
      subject: `Invoice ${invoice.number} from ${invoice.businessName}`,
      text: [
        `${invoice.businessName} has sent invoice ${invoice.number} for you to pay.`,
        "",
        invoice.description,
        "",
        customerUrl,
        note,
      ].join("\n"),
      sandbox,
    });
    customerDetail = result.stubbed
      ? "Approved. The customer link is live. Email was logged, not sent (no SMTP configured)."
      : "Approved. The customer link is live and the email was sent.";
  }
  await prisma.invoiceEvent.create({
    data: { invoiceId: invoice.id, type: "approved", channel: email ? "email" : "web", detail: customerDetail },
  });
  return { invoice: { ...invoice, status: next }, customerUrl, note, customerDetail };
}

export async function markInvoicePaid(invoiceId: string, traderId: string, detail: string) {
  const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, traderId } });
  if (!invoice || invoice.status === "DRAFT") return null;
  if (invoice.paidAt) return invoice;
  const now = new Date();
  return prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      status: "PAID",
      paidAt: now,
      jobCompletedAt: invoice.jobCompletedAt ?? now,
      events: { create: { type: "paid", channel: "web", detail } },
    },
  });
}
