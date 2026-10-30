import { notFound, redirect } from "next/navigation";
import { Flash } from "@/components/flash";
import { StatusPill } from "@/components/status-pill";
import { buttonPrimary, buttonSecondary, inputClass, labelClass } from "@/components/styles";
import { getCurrentUser } from "@/lib/auth";
import { billingConfigured, featureAllowed } from "@/lib/billing/plans";
import { CIS_INVOICE_NOTE, formatMoneyRow, invoiceMoneyRows, suggestedCis } from "@/lib/cis/calc";
import { prisma } from "@/lib/db";
import { firstParam, formatDate, formatGBP, penceToPoundsInput } from "@/lib/format";
import { isSandboxTrader } from "@/lib/sandbox";
import { CHASER_OFFSETS_DAYS } from "@/lib/invoices/chasers";
import { customerInvoicePath } from "@/lib/invoices/approval";
import { requestOrigin } from "@/lib/origin";
import { paymentNote } from "@/lib/whatsapp/plan";
import {
  approveInvoiceAction,
  markInvoicePaidAction,
  markJobCompleteAction,
  updateInvoiceFollowUps,
} from "@/server/invoice-actions";
import { saveInvoiceCis } from "@/server/cis-actions";

export const metadata = { title: "Invoice" };

const chaserLabels = ["Due date, a polite note", "7 days later, a firmer note", "14 days later, a direct note"];

export default async function InvoicePage({
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
  const invoice = await prisma.invoice.findFirst({
    where: { id, traderId: user.trader.id },
    include: {
      events: { orderBy: { createdAt: "asc" } },
      job: { select: { id: true, title: true } },
      customer: { select: { deductsCis: true, cisRateOverride: true } },
    },
  });
  if (!invoice) notFound();
  const sandbox = isSandboxTrader({ slug: user.trader.slug, email: user.email });
  const cisOn = featureAllowed({ plan: user.trader.plan, feature: "cis", sandbox, billingOn: billingConfigured() });
  const suggestion = suggestedCis({
    traderStatus: user.trader.cisStatus,
    customerDeducts: invoice.customer?.deductsCis ?? false,
    customerOverride: invoice.customer?.cisRateOverride ?? null,
  });
  const rows = invoiceMoneyRows(invoice);
  const origin = await requestOrigin();
  const publicUrl =
    invoice.status === "DRAFT" ? null : `${origin}${customerInvoicePath(invoice.status, invoice.publicToken).path}`;

  return (
    <div className="mx-auto grid max-w-2xl gap-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-muted">{invoice.number}</p>
          <h1 className="font-serif text-4xl">{invoice.customerName}</h1>
          <p className="mt-1 text-sm text-muted">
            Due {formatDate(invoice.dueAt)} · {invoice.cisApplies ? `pay ${formatGBP(invoice.amountDuePence)}` : formatGBP(invoice.totalPence)}
          </p>
          {invoice.job ? <p className="mt-2 text-sm"><a href={`/jobs/${invoice.job.id}`}>{invoice.job.title}</a></p> : null}
        </div>
        <StatusPill status={invoice.status} />
      </div>
      <Flash error={firstParam(query.error)} notice={firstParam(query.notice)} />
      <section className="card">
        <p className="whitespace-pre-wrap">{invoice.description}</p>
        <dl className="mt-3 max-w-sm text-sm">
          {rows.map((row) => (
            <div key={row.label} className={`flex justify-between gap-3 py-1 ${row.strong ? "font-semibold" : ""}`}>
              <dt>{row.label}</dt>
              <dd>{formatMoneyRow(row)}</dd>
            </div>
          ))}
        </dl>
        {invoice.cisApplies ? <p className="mt-3 text-sm leading-6 text-muted">{CIS_INVOICE_NOTE}</p> : null}
        <p className="mt-3 text-sm">
          <a href={`/api/invoices/${invoice.id}/pdf`}>Download PDF</a>
          {publicUrl ? <> · <a href={publicUrl}>Customer link</a></> : null}
        </p>
        <p className="mt-2 text-sm text-muted">{paymentNote(invoice.stripePaymentUrl)}</p>
      </section>

      {invoice.status === "DRAFT" && cisOn ? (
        <form action={saveInvoiceCis} className="card grid gap-3">
          <h2 className="font-serif text-2xl">CIS</h2>
          <p className="text-sm leading-6 text-muted">
            Labour and materials must add up to the net, {formatGBP(invoice.netPence)}. The deduction is a percentage of the labour only. It is not taken off materials or VAT. You choose the rate. Quotestick does not check it with HMRC.
          </p>
          {invoice.cisApplies && invoice.materialsPence === 0 ? (
            <p className="text-sm leading-6">The whole net is treated as labour until you enter a materials figure.</p>
          ) : null}
          {suggestion.needsRate && invoice.customer?.deductsCis ? (
            <p className="text-sm leading-6">This customer is marked as a contractor. Set your CIS status on Your page, or choose a rate here.</p>
          ) : null}
          <input type="hidden" name="invoiceId" value={invoice.id} />
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={labelClass}>
              Labour (£)
              <input className={inputClass} name="labour" inputMode="decimal" defaultValue={penceToPoundsInput(invoice.labourPence)} required />
            </label>
            <label className={labelClass}>
              Materials (£)
              <input className={inputClass} name="materials" inputMode="decimal" defaultValue={penceToPoundsInput(invoice.materialsPence)} required />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" name="cisApplies" defaultChecked={invoice.cisApplies} />
            Record a CIS deduction on this invoice
          </label>
          <label className={labelClass}>
            Rate
            <select className={inputClass} name="cisRate" defaultValue={String(invoice.cisApplies ? invoice.cisRate : suggestion.rate)}>
              <option value="0">Gross — 0%</option>
              <option value="20">Standard — 20%</option>
              <option value="30">Higher — 30%</option>
            </select>
          </label>
          <button className={`${buttonSecondary} w-full sm:w-auto`} type="submit">Save CIS record</button>
        </form>
      ) : null}
      {invoice.status === "DRAFT" && !cisOn ? (
        <p className="card text-sm leading-6">
          CIS records are on Pro. <a href="/billing">Open Plans</a>. This draft has no CIS deduction.
        </p>
      ) : null}

      {invoice.status === "DRAFT" ? (
        <form action={approveInvoiceAction}>
          <input type="hidden" name="invoiceId" value={invoice.id} />
          <button className={buttonPrimary} type="submit">Approve and send</button>
          <p className="mt-2 text-sm text-muted">The customer cannot open this invoice until you approve it.</p>
        </form>
      ) : null}

      <form action={updateInvoiceFollowUps} className="card grid gap-3">
        <h2 className="font-serif text-2xl">Payment reminders</h2>
        <p className="text-sm leading-6 text-muted">
          Reminders email the customer. They stop as soon as the invoice is paid. WhatsApp to the customer is not sent yet.
        </p>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="hidden" name="invoiceId" value={invoice.id} />
          <input type="checkbox" name="chaserEnabled" defaultChecked={invoice.chaserEnabled} />
          Send payment reminders for this invoice
        </label>
        <ol className="grid gap-2 text-sm">
          {CHASER_OFFSETS_DAYS.map((offset, index) => {
            const done = invoice.chaserStage > index;
            const current = invoice.status === "SENT" && !invoice.paidAt && invoice.chaserEnabled && invoice.chaserStage === index;
            return (
              <li key={offset} className={current ? "font-semibold text-ink" : "text-muted"}>
                {index + 1}. {chaserLabels[index]}
                {done ? " — sent" : current ? " — next" : ""}
              </li>
            );
          })}
        </ol>
        {invoice.paidAt ? <p className="text-sm font-semibold">Paid {formatDate(invoice.paidAt)}. Reminders have stopped.</p> : null}
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" name="reviewChaserEnabled" defaultChecked={invoice.reviewChaserEnabled} />
          Ask for a Google review after this job is complete
        </label>
        <p className="text-sm text-muted">
          {invoice.reviewClickedAt
            ? "The customer opened the review link. No further review notes will be sent."
            : invoice.jobCompletedAt
              ? `Review notes sent: ${invoice.reviewStage} of 3.`
              : "Review notes start after the invoice is paid or you mark the job complete."}
        </p>
        <button className={buttonSecondary} type="submit">Save reminder settings</button>
      </form>

      <div className="flex flex-wrap gap-3">
        {invoice.status === "SENT" ? (
          <form action={markInvoicePaidAction}>
            <input type="hidden" name="invoiceId" value={invoice.id} />
            <button className={buttonSecondary} type="submit">Mark paid</button>
          </form>
        ) : null}
        {!invoice.jobCompletedAt && invoice.status !== "DRAFT" ? (
          <form action={markJobCompleteAction}>
            <input type="hidden" name="id" value={invoice.id} />
            <input type="hidden" name="kind" value="invoice" />
            <button className={buttonSecondary} type="submit">Mark job complete</button>
          </form>
        ) : null}
      </div>

      <section className="grid gap-2">
        <h2 className="font-serif text-2xl">History</h2>
        {invoice.events.map((event) => (
          <p key={event.id} className="text-sm text-muted">
            {formatDate(event.createdAt)} · {event.detail}
          </p>
        ))}
      </section>
    </div>
  );
}
