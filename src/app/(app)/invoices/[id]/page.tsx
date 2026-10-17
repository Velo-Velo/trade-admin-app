import { notFound, redirect } from "next/navigation";
import { Flash } from "@/components/flash";
import { StatusPill } from "@/components/status-pill";
import { buttonPrimary, buttonSecondary } from "@/components/styles";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { firstParam, formatDate, formatGBP } from "@/lib/format";
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
    include: { events: { orderBy: { createdAt: "asc" } }, job: { select: { id: true, title: true } } },
  });
  if (!invoice) notFound();
  const origin = await requestOrigin();
  const publicUrl =
    invoice.status === "DRAFT" ? null : `${origin}${customerInvoicePath(invoice.status, invoice.publicToken).path}`;

  return (
    <div className="mx-auto grid max-w-2xl gap-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-muted">{invoice.number}</p>
          <h1 className="font-serif text-4xl">{invoice.customerName}</h1>
          <p className="mt-1 text-sm text-muted">Due {formatDate(invoice.dueAt)} · {formatGBP(invoice.totalPence)}</p>
          {invoice.job ? <p className="mt-2 text-sm"><a href={`/jobs/${invoice.job.id}`}>{invoice.job.title}</a></p> : null}
        </div>
        <StatusPill status={invoice.status} />
      </div>
      <Flash error={firstParam(query.error)} notice={firstParam(query.notice)} />
      <section className="card">
        <p className="whitespace-pre-wrap">{invoice.description}</p>
        <p className="mt-3 text-sm text-muted">
          Net {formatGBP(invoice.netPence)} · VAT {formatGBP(invoice.vatPence)} · Total {formatGBP(invoice.totalPence)}
        </p>
        <p className="mt-3 text-sm">
          <a href={`/api/invoices/${invoice.id}/pdf`}>Download PDF</a>
          {publicUrl ? <> · <a href={publicUrl}>Customer link</a></> : null}
        </p>
        <p className="mt-2 text-sm text-muted">{paymentNote(invoice.stripePaymentUrl)}</p>
      </section>

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
