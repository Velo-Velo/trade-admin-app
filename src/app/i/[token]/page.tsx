import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DemoBanner } from "@/components/demo-banner";
import { DocumentMast } from "@/components/document-mast";
import { Flash } from "@/components/flash";
import { buttonPrimary } from "@/components/styles";
import { billingConfigured } from "@/lib/billing/plans";
import { prisma } from "@/lib/db";
import { isDemoSlug } from "@/lib/demo";
import { firstParam, formatDate, formatGBP } from "@/lib/format";
import { resolvePublicInvoiceView } from "@/lib/invoices/approval";
import { cardButtonVisible } from "@/lib/payments/connect-status";
import { isSandboxTrader } from "@/lib/sandbox";
import { stripeConfigured } from "@/lib/stripe";
import { paymentNote } from "@/lib/whatsapp/plan";
import { startInvoicePayment } from "@/server/customer-actions";

export const metadata: Metadata = { title: "Invoice", robots: { index: false, follow: false } };

export default async function PublicInvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const { token } = await params;
  const query = await searchParams;
  const invoice = resolvePublicInvoiceView(
    await prisma.invoice.findUnique({ where: { publicToken: token }, include: { trader: true } }),
  );
  if (!invoice) notFound();
  const paid = invoice.status === "PAID";
  const sandbox = isSandboxTrader({ slug: invoice.trader.slug });
  const cardPay = cardButtonVisible({
    stripeConfigured: stripeConfigured(),
    sandbox,
    stripeAccountId: invoice.trader.stripeAccountId,
    stripeChargesEnabled: invoice.trader.stripeChargesEnabled,
    plan: invoice.trader.plan,
    billingOn: billingConfigured(),
  });

  return (
    <div className="min-h-screen">
      {isDemoSlug(invoice.trader.slug) ? <DemoBanner kind="sample" /> : null}
      <DocumentMast
        theme={invoice.trader.siteTheme}
        brand={invoice.trader.brandColour}
        name={invoice.businessName}
        kicker={`Invoice ${invoice.number}`}
      />
      <main id="main" className="mx-auto grid max-w-3xl gap-8 px-5 py-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="lg:col-span-2">
          <Flash error={firstParam(query.error)} notice={firstParam(query.notice)} />
        </div>
        <section>
          <h1 className="font-serif text-4xl tracking-tight">{invoice.customerName}</h1>
          <p className="mt-2 text-sm text-muted">
            Due {formatDate(invoice.dueAt)}
            {paid && invoice.paidAt ? ` · Paid ${formatDate(invoice.paidAt)}` : ""}
          </p>
          <p className="mt-5 whitespace-pre-wrap leading-7">{invoice.description}</p>
          <dl className="mt-6 max-w-xs border-t border-sand text-sm">
            <div className="flex justify-between py-2"><dt>Net</dt><dd>{formatGBP(invoice.netPence)}</dd></div>
            <div className="flex justify-between py-2"><dt>{invoice.vatRate > 0 ? `VAT ${invoice.vatRate}%` : "VAT"}</dt><dd>{formatGBP(invoice.vatPence)}</dd></div>
            <div className="flex justify-between border-t border-sand py-3 font-serif text-3xl tracking-tight"><dt>Total</dt><dd>{formatGBP(invoice.totalPence)}</dd></div>
          </dl>
          <p className="mt-3 max-w-md text-sm leading-6 text-muted">
            {invoice.vatRate > 0
              ? "The total includes VAT."
              : "No VAT has been added. This business is not VAT registered on this invoice."}
          </p>
          <p className="mt-4 text-sm">
            <a href={`/i/${token}/pdf`}>Download PDF</a>
          </p>
        </section>
        <aside className="h-fit border border-sand bg-white p-5">
          <h2 className="font-serif text-2xl tracking-tight">{paid ? "Paid" : "How to pay"}</h2>
          {invoice.bankAccountName ? (
            <dl className="mt-4 text-sm leading-6">
              <div className="flex justify-between gap-3"><dt className="text-muted">Name</dt><dd>{invoice.bankAccountName}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted">Sort code</dt><dd>{invoice.bankSortCode}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted">Account</dt><dd>{invoice.bankAccountNumber}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted">Reference</dt><dd>{invoice.number}</dd></div>
            </dl>
          ) : (
            <p className="mt-3 text-sm leading-6">Bank details were not on this invoice. Contact {invoice.businessName}.</p>
          )}
          {paid ? (
            <p className="mt-4 text-sm leading-6">This invoice is marked paid. Payment reminders have stopped.</p>
          ) : cardPay ? (
            <form action={startInvoicePayment} className="mt-4">
              <input type="hidden" name="token" value={token} />
              <button className={`${buttonPrimary} w-full`} type="submit">Pay {formatGBP(invoice.totalPence)} by card</button>
            </form>
          ) : invoice.stripePaymentUrl && !sandbox ? (
            <a className={`${buttonPrimary} mt-4 w-full`} href={invoice.stripePaymentUrl}>
              Pay {formatGBP(invoice.totalPence)} by card
            </a>
          ) : (
            <p className="mt-4 text-sm leading-6">{paymentNote(null)}</p>
          )}
        </aside>
      </main>
    </div>
  );
}
