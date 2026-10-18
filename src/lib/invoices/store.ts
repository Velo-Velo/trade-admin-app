import { prisma } from "@/lib/db";
import { newToken } from "@/lib/auth";
import { findOrCreateCustomer } from "@/lib/customers/store";
import { soleUninvoicedJob } from "@/lib/jobs/board";
import { customerEmail } from "@/lib/format";
import { deliver } from "@/lib/channels";
import { createGbpPaymentLink } from "@/lib/payments/link";
import { approveInvoiceDraft, customerInvoicePath } from "@/lib/invoices/approval";
import { splitVat } from "@/lib/invoices/vat";
import type { ParsedInvoice } from "@/lib/invoices/parse";
import { paymentNote } from "@/lib/whatsapp/plan";

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
            detail: "Draft invoice. Not sent to the customer.",
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
  const next = approveInvoiceDraft(invoice.status);
  const pay = await createGbpPaymentLink({
    name: `Invoice ${invoice.number}`,
    amountPence: invoice.totalPence,
    metadata: { invoiceId: invoice.id },
  });
  const now = new Date();
  await prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      status: next,
      approvedAt: now,
      sentAt: now,
      stripePaymentLinkId: pay.id,
      stripePaymentUrl: pay.url,
    },
  });
  const released = customerInvoicePath(next, invoice.publicToken);
  const customerUrl = `${origin}${released.path}`;
  const note = paymentNote(pay.url);
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
