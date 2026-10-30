import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CoolingOff } from "@/components/cooling-off";
import { DemoBanner } from "@/components/demo-banner";
import { DocumentMast } from "@/components/document-mast";
import { Flash } from "@/components/flash";
import { buttonPrimary, buttonSecondary } from "@/components/styles";
import { prisma } from "@/lib/db";
import { firstParam, formatDate, formatGBP, formatQuantity, quoteTotals, telHref } from "@/lib/format";
import { isDemoSlug } from "@/lib/demo";
import { isQuoteExpired } from "@/lib/chasers/plan";
import { expireQuoteNow } from "@/lib/chasers/queue";
import { resolvePublicQuoteView } from "@/lib/quotes/approval";
import { billingConfigured } from "@/lib/billing/plans";
import { cardButtonVisible } from "@/lib/payments/connect-status";
import { isSandboxTrader } from "@/lib/sandbox";
import { stripeConfigured } from "@/lib/stripe";
import { acceptQuote, declineQuote, startDeposit } from "@/server/customer-actions";

export const metadata: Metadata = {
  title: "Quote",
  robots: { index: false, follow: false },
};

export default async function PublicQuotePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string; notice?: string; deposit?: string }>;
}) {
  const { token } = await params;
  const query = await searchParams;
  const quote = await prisma.quote.findUnique({
    where: { publicToken: token },
    include: { lines: { orderBy: { sortOrder: "asc" } }, trader: true },
  });
  const now = new Date();
  if (quote && quote.status === "SENT" && isQuoteExpired(quote, now)) {
    await expireQuoteNow(quote.id, now);
    quote.status = "EXPIRED";
  }
  const visible = resolvePublicQuoteView(quote);
  if (!visible || !quote) notFound();
  const expired = visible.status === "EXPIRED" || isQuoteExpired(visible, now);

  const cardPay = cardButtonVisible({
    stripeConfigured: stripeConfigured(),
    sandbox: isSandboxTrader({ slug: visible.trader.slug }),
    stripeAccountId: visible.trader.stripeAccountId,
    stripeChargesEnabled: visible.trader.stripeChargesEnabled,
    plan: visible.trader.plan,
    billingOn: billingConfigured(),
  });
  const totals = quoteTotals(
    visible.lines.map((line) => ({
      kind: line.kind,
      quantity: Number(line.quantity),
      unitPricePence: line.unitPricePence,
    })),
    visible.depositPercent,
  );
  const depositNote =
    query.deposit === "cancelled"
      ? "The card payment was cancelled. No payment has been taken."
      : query.deposit === "pending"
        ? "If you have just paid, it can take a moment to show here. Stripe sends the receipt."
        : undefined;

  return (
    <div className="min-h-screen">
      {isDemoSlug(visible.trader.slug) ? <DemoBanner kind="sample" /> : null}
      <DocumentMast
        theme={visible.trader.siteTheme}
        brand={visible.trader.brandColour}
        name={visible.trader.businessName}
        kicker={`Quote ${visible.number} · ${formatDate(visible.createdAt)}`}
      />
      <main id="main" className="mx-auto grid max-w-3xl gap-8 px-5 py-8">
        <Flash error={firstParam(query.error)} notice={firstParam(query.notice) ?? depositNote} />
        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_16rem] lg:items-end">
          <div>
            <h1 className="font-serif text-4xl tracking-tight">{visible.customerName}</h1>
            <p className="mt-2 text-sm text-muted">{visible.postcode}</p>
            <p className="mt-4 whitespace-pre-wrap leading-7">{visible.jobDescription}</p>
          </div>
          <p className="text-sm">
            <a href={telHref(visible.trader.phone)}>Call {visible.trader.phone}</a>
          </p>
        </section>

        <section className="border border-sand bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-sand text-xs font-semibold uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Line</th>
                <th className="px-4 py-3 font-semibold">Qty</th>
                <th className="px-4 py-3 text-right font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody>
              {visible.lines.map((line) => (
                <tr key={line.id} className="border-b border-sand last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-semibold">{line.description}</p>
                    <p className="text-muted">{line.kind === "LABOUR" ? "Labour" : "Materials"} · {formatGBP(line.unitPricePence)} / {line.unit}</p>
                  </td>
                  <td className="px-4 py-3 align-top">{formatQuantity(Number(line.quantity))}</td>
                  <td className="px-4 py-3 text-right align-top font-semibold">{formatGBP(Math.round(Number(line.quantity) * line.unitPricePence))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="ml-auto w-full max-w-xs text-sm">
          <p className="flex justify-between py-1"><span>Labour</span><span>{formatGBP(totals.labour)}</span></p>
          <p className="flex justify-between py-1"><span>Materials</span><span>{formatGBP(totals.materials)}</span></p>
          <p className="mt-1 flex justify-between border-t border-sand py-2 font-serif text-2xl tracking-tight"><span>Total</span><span>{formatGBP(totals.total)}</span></p>
          <p className="flex justify-between py-1"><span>Deposit ({visible.depositPercent}%)</span><span>{formatGBP(totals.deposit)}</span></p>
          <p className="mt-3 text-muted">No VAT has been added. This quote assumes the trader is not VAT registered, unless they have told you otherwise.</p>
        </section>

        {visible.domestic ? <CoolingOff text={visible.coolingOffText} /> : null}

        {visible.status === "SENT" && !expired ? (
          <div className="grid gap-3 border-t border-sand pt-6 sm:grid-cols-[1fr_auto] sm:items-center">
            <p className="text-sm leading-6">
              Accepting tells {visible.trader.businessName} you want this work. It does not take a card payment by itself.
              {visible.expiresAt ? ` This quote is open until ${formatDate(visible.expiresAt)}.` : ""}
            </p>
            <div className="flex flex-wrap gap-2">
              <form action={acceptQuote}>
                <input type="hidden" name="token" value={token} />
                <button className={buttonPrimary} type="submit">Accept quote</button>
              </form>
              <form action={declineQuote}>
                <input type="hidden" name="token" value={token} />
                <button className={buttonSecondary} type="submit">Decline</button>
              </form>
            </div>
          </div>
        ) : null}

        {visible.status === "ACCEPTED" ? (
          <section className="border-t-[6px] border-[#16181d] pt-6" style={{ borderTopColor: visible.trader.brandColour }}>
            <h2 className="font-serif text-3xl tracking-tight">Accepted</h2>
            {visible.depositPaidAt ? (
              <p className="mt-3">Deposit paid on {formatDate(visible.depositPaidAt)}. Thank you.</p>
            ) : totals.deposit <= 0 ? (
              <p className="mt-3">No deposit is requested. {visible.trader.businessName} will be in touch.</p>
            ) : cardPay ? (
              <form action={startDeposit} className="mt-4">
                <input type="hidden" name="token" value={token} />
                <button className={buttonPrimary} type="submit">Pay {formatGBP(totals.deposit)} deposit by card</button>
              </form>
            ) : visible.stripePaymentUrl && !isSandboxTrader({ slug: visible.trader.slug }) ? (
              <p className="mt-4">
                <a className={buttonPrimary} href={visible.stripePaymentUrl}>Pay {formatGBP(totals.deposit)} deposit by card</a>
              </p>
            ) : (
              <p className="mt-3 text-sm leading-6">
                Card payments are not switched on. No payment has been taken. {visible.trader.businessName} will arrange the {formatGBP(totals.deposit)} deposit with you.
              </p>
            )}
          </section>
        ) : null}

        {visible.status === "DECLINED" ? (
          <p className="border border-sand bg-white px-4 py-3">You declined this quote. {visible.trader.businessName} has been told.</p>
        ) : null}
        {visible.status === "LOST" ? (
          <p className="border border-sand bg-white px-4 py-3">This quote is closed. {visible.trader.businessName} is not waiting for a reply.</p>
        ) : null}
        {expired ? (
          <p className="border border-sand bg-white px-4 py-3">
            This quote is no longer open, so it cannot be accepted. Contact {visible.trader.businessName} if you still want the work.
          </p>
        ) : null}
      </main>
    </div>
  );
}
