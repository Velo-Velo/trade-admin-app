import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CoolingOff } from "@/components/cooling-off";
import { DemoBanner } from "@/components/demo-banner";
import { Flash } from "@/components/flash";
import { buttonClay, buttonPrimary, buttonSecondary } from "@/components/styles";
import { prisma } from "@/lib/db";
import { firstParam, formatDate, formatGBP, formatQuantity, quoteTotals, telHref } from "@/lib/format";
import { foregroundFor } from "@/lib/brand";
import { isDemoSlug } from "@/lib/demo";
import { resolvePublicQuoteView } from "@/lib/quotes/approval";
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
  // Drafts are hidden the same way as a missing quote. The token is not enough.
  const visible = resolvePublicQuoteView(quote);
  if (!visible || !quote) notFound();

  const totals = quoteTotals(
    visible.lines.map((line) => ({
      kind: line.kind,
      quantity: Number(line.quantity),
      unitPricePence: line.unitPricePence,
    })),
    visible.depositPercent,
  );
  const ink = foregroundFor(visible.trader.brandColour);
  const depositNote =
    query.deposit === "cancelled"
      ? "The card payment was cancelled. No payment has been taken."
      : query.deposit === "pending"
        ? "If you have just paid, it can take a moment to show here. Stripe sends the receipt."
        : undefined;

  return (
    <div className="min-h-screen bg-paper">
      {isDemoSlug(visible.trader.slug) ? <DemoBanner kind="sample" /> : null}
      <header style={{ background: visible.trader.brandColour, color: ink }}>
        <div className="mx-auto max-w-2xl px-5 py-8">
          <p className="font-serif text-3xl">{visible.trader.logoText}</p>
          <p className="mt-2 text-sm opacity-80">Quote {visible.number} · {formatDate(visible.createdAt)}</p>
        </div>
      </header>
      <main id="main" className="mx-auto grid max-w-2xl gap-5 px-5 py-8">
        <Flash error={firstParam(query.error)} notice={firstParam(query.notice) ?? depositNote} />
        <section>
          <h1 className="font-serif text-4xl">Quote for {visible.customerName}</h1>
          <p className="mt-2 text-sm text-muted">{visible.postcode}</p>
          <p className="mt-3 whitespace-pre-wrap leading-7">{visible.jobDescription}</p>
          <p className="mt-3 text-sm">
            <a href={telHref(visible.trader.phone)}>Call {visible.trader.phone}</a>
          </p>
        </section>
        <section className="grid gap-3">
          {visible.lines.map((line) => (
            <article key={line.id} className="card">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                {line.kind === "LABOUR" ? "Labour" : "Materials"}
              </p>
              <div className="mt-1 flex items-start justify-between gap-3">
                <p className="font-semibold">{line.description}</p>
                <p className="font-semibold">{formatGBP(Math.round(Number(line.quantity) * line.unitPricePence))}</p>
              </div>
              <p className="mt-1 text-sm text-muted">
                {formatQuantity(Number(line.quantity))} {line.unit} × {formatGBP(line.unitPricePence)}
              </p>
            </article>
          ))}
        </section>
        <section className="card text-sm">
          <p className="flex justify-between"><span>Labour</span><span>{formatGBP(totals.labour)}</span></p>
          <p className="flex justify-between"><span>Materials</span><span>{formatGBP(totals.materials)}</span></p>
          <p className="mt-1 flex justify-between text-base font-semibold"><span>Total</span><span>{formatGBP(totals.total)}</span></p>
          <p className="flex justify-between"><span>Deposit ({visible.depositPercent}%)</span><span>{formatGBP(totals.deposit)}</span></p>
          <p className="mt-3 text-muted">No VAT has been added. This draft assumes the trader is not VAT registered, unless they have told you otherwise.</p>
        </section>
        {visible.domestic ? <CoolingOff text={visible.coolingOffText} /> : null}

        {visible.status === "SENT" ? (
          <div className="grid gap-3">
            <p className="text-sm leading-6 text-muted">
              Accepting tells {visible.trader.businessName} you want them to do this work. It does not take a card payment by itself.
            </p>
            <form action={acceptQuote}>
              <input type="hidden" name="token" value={token} />
              <button className={`${buttonPrimary} w-full`} type="submit">
                Accept quote
              </button>
            </form>
            <form action={declineQuote}>
              <input type="hidden" name="token" value={token} />
              <button className={`${buttonSecondary} w-full`} type="submit">
                Decline
              </button>
            </form>
          </div>
        ) : null}

        {visible.status === "ACCEPTED" ? (
          <section className="card grid gap-3">
            <h2 className="font-serif text-2xl">Accepted</h2>
            {visible.depositPaidAt ? (
              <p>Deposit paid on {formatDate(visible.depositPaidAt)}. Thank you.</p>
            ) : totals.deposit <= 0 ? (
              <p>No deposit is requested on this quote. {visible.trader.businessName} will be in touch.</p>
            ) : visible.stripePaymentUrl ? (
              <p>
                <a href={visible.stripePaymentUrl}>Pay {formatGBP(totals.deposit)} deposit by card</a>
              </p>
            ) : stripeConfigured() ? (
              <form action={startDeposit}>
                <input type="hidden" name="token" value={token} />
                <button className={buttonClay} type="submit">
                  Pay {formatGBP(totals.deposit)} deposit by card
                </button>
              </form>
            ) : (
              <p className="text-sm leading-6">
                Card payments are not switched on for this account. No payment has been taken. {visible.trader.businessName} will arrange the {formatGBP(totals.deposit)} deposit with you.
              </p>
            )}
          </section>
        ) : null}

        {visible.status === "DECLINED" ? (
          <p className="card">You declined this quote. {visible.trader.businessName} has been told.</p>
        ) : null}
      </main>
    </div>
  );
}
