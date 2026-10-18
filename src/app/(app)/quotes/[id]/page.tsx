import { notFound, redirect } from "next/navigation";
import { CoolingOff } from "@/components/cooling-off";
import { CopyLink } from "@/components/copy-link";
import { Flash } from "@/components/flash";
import { QuoteEditor, type EditorLine } from "@/components/quote-editor";
import { StatusPill } from "@/components/status-pill";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  contactHref,
  firstParam,
  formatDate,
  formatGBP,
  formatQuantity,
  penceToPoundsInput,
  quoteTotals,
} from "@/lib/format";
import { requestOrigin } from "@/lib/origin";
import { deliveryForCustomer } from "@/lib/quotes/approval";
import { markJobCompleteAction, updateQuoteReview } from "@/server/invoice-actions";
import { markQuoteLostAction } from "@/server/chase-actions";
import { buttonSecondary } from "@/components/styles";

export const metadata = { title: "Quote" };

export default async function QuotePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user?.trader) redirect("/onboarding");
  const { id } = await params;
  const query = await searchParams;
  const quote = await prisma.quote.findFirst({
    where: { id, traderId: user.trader.id },
    include: {
      lines: { orderBy: { sortOrder: "asc" } },
      events: { orderBy: { createdAt: "asc" } },
      job: { select: { id: true } },
      chases: { where: { status: "PENDING" }, take: 1 },
      enquiry: { include: { photos: { select: { id: true, filename: true } } } },
    },
  });
  if (!quote) notFound();

  const totals = quoteTotals(
    quote.lines.map((line) => ({
      kind: line.kind,
      quantity: Number(line.quantity),
      unitPricePence: line.unitPricePence,
    })),
    quote.depositPercent,
  );
  const origin = await requestOrigin();
  const publicPath = quote.status === "DRAFT" ? null : deliveryForCustomer(quote.status, quote.publicToken).path;
  const publicUrl = publicPath ? `${origin}${publicPath}` : null;
  const contact = contactHref(quote.customerContact);

  const initialLines: EditorLine[] = quote.lines.map((line) => ({
    key: line.id,
    kind: line.kind,
    description: line.description,
    quantity: formatQuantity(Number(line.quantity)),
    unit: line.unit,
    unitPrice: penceToPoundsInput(line.unitPricePence),
    priceBookItemId: line.priceBookItemId,
    lastPaidPence: line.lastPaidPence,
  }));

  return (
    <div className="mx-auto grid max-w-2xl gap-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-muted">{quote.number}</p>
          <h1 className="font-serif text-4xl">{quote.customerName}</h1>
          <p className="mt-1 text-sm text-muted">
            {contact ? <a href={contact}>{quote.customerContact}</a> : quote.customerContact} · {quote.postcode}
          </p>
          {quote.job ? <p className="mt-2 text-sm"><a href={`/jobs/${quote.job.id}`}>Open the job</a></p> : null}
        </div>
        <StatusPill status={quote.status} />
      </div>
      {quote.status !== "DRAFT" ? (
        <section className="card grid gap-3">
          <h2 className="font-serif text-2xl">After the job</h2>
          <p className="text-sm text-muted">
            {quote.reviewClickedAt
              ? "The customer opened the review link. No further review notes will be sent."
              : quote.jobCompletedAt
                ? `Job complete. Review notes sent: ${quote.reviewStage} of 3.`
                : "Mark the job complete when the work is done. Review notes can then start."}
          </p>
          <form action={updateQuoteReview} className="grid gap-2">
            <input type="hidden" name="id" value={quote.id} />
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input type="checkbox" name="reviewChaserEnabled" defaultChecked={quote.reviewChaserEnabled} />
              Ask for a Google review for this job
            </label>
            <button className={buttonSecondary} type="submit">Save</button>
          </form>
          {!quote.jobCompletedAt ? (
            <form action={markJobCompleteAction}>
              <input type="hidden" name="id" value={quote.id} />
              <input type="hidden" name="kind" value="quote" />
              <button className={buttonSecondary} type="submit">Mark job complete</button>
            </form>
          ) : null}
        </section>
      ) : null}
      <Flash error={firstParam(query.error)} notice={firstParam(query.notice)} />
      <p className="whitespace-pre-wrap text-sm leading-6">{quote.jobDescription}</p>
      {quote.enquiry && quote.enquiry.photos.length > 0 ? (
        <div className="grid grid-cols-2 gap-3">
          {quote.enquiry.photos.map((photo) => (
            <img
              key={photo.id}
              src={`/api/photos/${photo.id}`}
              alt={photo.filename}
              className="h-40 w-full rounded-xl object-cover"
            />
          ))}
        </div>
      ) : null}

      {quote.status === "DRAFT" ? (
        <QuoteEditor
          quoteId={quote.id}
          initialLines={initialLines}
          depositPercent={quote.depositPercent}
          domestic={quote.domestic}
          draftNote={quote.draftNote}
        />
      ) : (
        <div className="grid gap-4">
          {publicUrl ? (
            <section className="card grid gap-3">
              <h2 className="font-serif text-2xl">Customer link</h2>
              <a href={publicUrl} className="break-all text-sm">
                {publicUrl}
              </a>
              <CopyLink href={publicUrl} />
            </section>
          ) : null}
          <section className="grid gap-3">
            {quote.lines.map((line) => (
              <article key={line.id} className="card">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                  {line.kind === "LABOUR" ? "Labour" : "Materials"}
                </p>
                <p className="mt-1 font-semibold">{line.description}</p>
                <p className="mt-1 text-sm text-muted">
                  {formatQuantity(Number(line.quantity))} {line.unit} × {formatGBP(line.unitPricePence)}
                </p>
                {line.lastPaidPence !== null ? (
                  <p className="text-sm text-muted">Last paid {formatGBP(line.lastPaidPence)}</p>
                ) : null}
              </article>
            ))}
          </section>
          <section className="card text-sm">
            <p className="flex justify-between"><span>Labour</span><span>{formatGBP(totals.labour)}</span></p>
            <p className="flex justify-between"><span>Materials</span><span>{formatGBP(totals.materials)}</span></p>
            <p className="mt-1 flex justify-between text-base font-semibold"><span>Total</span><span>{formatGBP(totals.total)}</span></p>
            <p className="flex justify-between"><span>Deposit ({quote.depositPercent}%)</span><span>{formatGBP(totals.deposit)}</span></p>
            {quote.depositPaidAt ? <p className="mt-2 font-semibold text-pine">Deposit marked paid {formatDate(quote.depositPaidAt)}.</p> : null}
          </section>
          {quote.domestic ? <CoolingOff text={quote.coolingOffText} /> : null}
          {quote.chases.length > 0 ? (
            <p className="card text-sm leading-6">
              A follow-up is waiting in <a href="/follow-ups">Follow-ups</a>. It has not been sent.
            </p>
          ) : null}
          {quote.status === "SENT" ? (
            <form action={markQuoteLostAction} className="card grid gap-3">
              <h2 className="font-serif text-2xl">No reply</h2>
              <p className="text-sm leading-6 text-muted">
                Mark the quote lost if the customer is not going ahead. Follow-ups stop. The customer is not emailed.
              </p>
              <input type="hidden" name="quoteId" value={quote.id} />
              <button className={`${buttonSecondary} w-full sm:w-auto`} type="submit">Mark lost</button>
            </form>
          ) : null}
          {quote.status === "LOST" ? (
            <p className="card text-sm leading-6">This quote is marked lost. Follow-ups have stopped.</p>
          ) : null}
        </div>
      )}

      {quote.events.length > 0 ? (
        <section>
          <h2 className="font-serif text-2xl">History</h2>
          <ol className="mt-3 grid gap-2">
            {quote.events.map((event) => (
              <li key={event.id} className="text-sm text-muted">
                <span className="font-semibold text-ink">{formatDate(event.createdAt)}</span> · {event.detail}
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
}
