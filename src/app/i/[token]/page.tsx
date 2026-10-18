import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DemoBanner } from "@/components/demo-banner";
import { prisma } from "@/lib/db";
import { isDemoSlug } from "@/lib/demo";
import { formatDate, formatGBP } from "@/lib/format";
import { resolvePublicInvoiceView } from "@/lib/invoices/approval";
import { paymentNote } from "@/lib/whatsapp/plan";

export const metadata: Metadata = { title: "Invoice", robots: { index: false, follow: false } };

export default async function PublicInvoicePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invoice = resolvePublicInvoiceView(
    await prisma.invoice.findUnique({ where: { publicToken: token }, include: { trader: true } }),
  );
  if (!invoice) notFound();
  return (
    <div className="min-h-screen bg-paper">
      {isDemoSlug(invoice.trader.slug) ? <DemoBanner kind="sample" /> : null}
      <main id="main" className="mx-auto grid max-w-2xl gap-5 px-5 py-8">
        <header>
          <p className="text-sm font-semibold uppercase tracking-wide text-pine">{invoice.businessName}</p>
          <h1 className="mt-2 font-serif text-4xl">Invoice {invoice.number}</h1>
          <p className="mt-2 text-sm text-muted">
            {invoice.customerName} · Due {formatDate(invoice.dueAt)}
            {invoice.status === "PAID" && invoice.paidAt ? ` · Paid ${formatDate(invoice.paidAt)}` : ""}
          </p>
        </header>
        <section className="card">
          <p className="whitespace-pre-wrap leading-7">{invoice.description}</p>
          <p className="mt-4 flex justify-between text-sm"><span>Net</span><span>{formatGBP(invoice.netPence)}</span></p>
          <p className="flex justify-between text-sm"><span>{invoice.vatRate > 0 ? `VAT ${invoice.vatRate}%` : "VAT"}</span><span>{formatGBP(invoice.vatPence)}</span></p>
          <p className="mt-1 flex justify-between font-semibold"><span>Total</span><span>{formatGBP(invoice.totalPence)}</span></p>
          <p className="mt-3 text-sm text-muted">
            {invoice.vatRate > 0
              ? "The total includes VAT."
              : "No VAT has been added. This business is not VAT registered on this invoice."}
          </p>
        </section>
        <section className="card text-sm leading-6">
          <h2 className="font-serif text-2xl">How to pay</h2>
          {invoice.bankAccountName ? (
            <p className="mt-2">
              {invoice.bankAccountName}<br />
              Sort code {invoice.bankSortCode}<br />
              Account {invoice.bankAccountNumber}<br />
              Reference {invoice.number}
            </p>
          ) : (
            <p className="mt-2">Bank details were not on this invoice. Contact {invoice.businessName}.</p>
          )}
          {invoice.stripePaymentUrl ? (
            <p className="mt-3">
              <a href={invoice.stripePaymentUrl}>Pay {formatGBP(invoice.totalPence)} by card</a>
            </p>
          ) : (
            <p className="mt-3">{paymentNote(null)}</p>
          )}
          <p className="mt-3">
            <a href={`/i/${token}/pdf`}>Download PDF</a>
          </p>
        </section>
      </main>
    </div>
  );
}
