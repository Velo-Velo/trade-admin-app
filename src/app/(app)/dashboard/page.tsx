import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { loadUpcomingReminders } from "@/lib/chasers/load";
import { ReminderList } from "@/components/reminder-list";
import { formatDate, formatGBP, quoteTotals } from "@/lib/format";
import { checklistProgress } from "@/lib/checklist/catalog";
import { StatusPill } from "@/components/status-pill";
import { buttonPrimary, inputClass, labelClass } from "@/components/styles";
import { createInvoiceFromText } from "@/server/invoice-actions";
import { redirect } from "next/navigation";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user?.trader) redirect("/onboarding");
  const traderId = user.trader.id;
  const now = new Date();
  const [enquiryCount, grouped, drafts, checklist, chaseCount, upcoming, receiptCount] = await Promise.all([
    prisma.enquiry.count({ where: { traderId } }),
    prisma.quote.groupBy({
      by: ["status"],
      where: { traderId },
      _count: { _all: true },
    }),
    prisma.quote.findMany({
      where: { traderId, status: "DRAFT" },
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { lines: true },
    }),
    prisma.checklistItem.findMany({ where: { traderId } }),
    prisma.customerChase.count({ where: { traderId, status: "PENDING" } }),
    loadUpcomingReminders(traderId, now),
    prisma.expense.count({ where: { traderId, status: "NEEDS_REVIEW" } }),
  ]);
  const remindWeeks = user.trader.serviceRemindWeeks;
  const countFor = (status: "DRAFT" | "SENT" | "ACCEPTED") =>
    grouped.find((row) => row.status === status)?._count._all ?? 0;
  const progress = checklistProgress(checklist);

  const stats = [
    ["Enquiries", enquiryCount],
    ["Drafts to approve", countFor("DRAFT")],
    ["Sent", countFor("SENT")],
    ["Accepted", countFor("ACCEPTED")],
  ];

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="font-serif text-4xl">{user.trader.businessName}</h1>
        <p className="mt-2 text-muted">
          Your page is live at{" "}
          <a href={`/t/${user.trader.slug}`}>/t/{user.trader.slug}</a>
        </p>
      </div>
      <section className="grid gap-3 sm:grid-cols-4">
        {stats.map(([label, value]) => (
          <article key={String(label)} className="card">
            <p className="text-sm text-muted">{label}</p>
            <p className="mt-1 font-serif text-3xl">{value}</p>
          </article>
        ))}
      </section>
      <section className="card flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-2xl">Follow-ups</h2>
          <p className="mt-1 text-sm text-muted">
            {chaseCount === 0
              ? "No quote or service reminders are waiting for you to send."
              : `${chaseCount} waiting for you to send.`}
          </p>
        </div>
        <a href="/follow-ups" className="text-sm font-semibold">Open the queue</a>
      </section>
      <section className="grid gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-serif text-2xl">Upcoming reminders</h2>
          <a href="/follow-ups" className="text-sm font-semibold">Follow-ups</a>
        </div>
        <p className="text-sm text-muted">
          Repeating jobs and customer reminders due in the next 18 months. Ones inside the next {remindWeeks} weeks are marked due soon.
        </p>
        <ReminderList
          items={upcoming.slice(0, 8)}
          now={now}
          remindWeeks={remindWeeks}
          empty={`Nothing is due in the next 18 months. Add a repeating service on a job, or a reminder on a customer.`}
        />
      </section>
      <section className="card flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-2xl">Receipts</h2>
          <p className="mt-1 text-sm text-muted">
            {receiptCount === 0
              ? "No receipt photos are waiting to be checked."
              : `${receiptCount} waiting for you to check.`}
          </p>
        </div>
        <a href="/receipts" className="text-sm font-semibold">Open receipts</a>
      </section>
      <section className="card flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-2xl">Jobs</h2>
          <p className="mt-1 text-sm text-muted">Booked, in progress and done. Accepted quotes appear in Booked.</p>
        </div>
        <a href="/jobs" className="text-sm font-semibold">Open the board</a>
      </section>
      <section className="card flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-2xl">RAMS</h2>
          <p className="mt-1 text-sm text-muted">
            Draft a risk assessment and method statement from a job. You check it before anyone else sees it.
          </p>
        </div>
        <a href="/rams" className="text-sm font-semibold">Open RAMS</a>
      </section>
      <form action={createInvoiceFromText} className="card grid gap-3">
        <h2 className="font-serif text-2xl">Quick invoice</h2>
        <p className="text-sm text-muted">One line creates a draft. The customer is not sent anything until you approve it.</p>
        <label className={labelClass}>
          Invoice
          <textarea className={inputClass} name="text" rows={2} required placeholder="Invoice Mrs Jones, replaced tap, £80" />
        </label>
        <button className={buttonPrimary} type="submit">Create draft invoice</button>
      </form>
      <section className="card">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-serif text-2xl">Checklist</h2>
          <a href="/checklist" className="text-sm font-semibold">
            Open
          </a>
        </div>
        <p className="mt-2 text-sm text-muted">
          {progress.done} of {progress.total} done
        </p>
        <div className="mt-3 h-2 rounded-full bg-sand" aria-hidden="true">
          <div className="h-2 rounded-full bg-pine" style={{ width: `${progress.percent}%` }} />
        </div>
      </section>
      <section className="grid gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-2xl">Drafts waiting for approval</h2>
          <a href="/quotes" className="text-sm font-semibold">
            All quotes
          </a>
        </div>
        {drafts.length === 0 ? (
          <p className="card text-sm text-muted">No drafts waiting. Share your page to take an enquiry, or start a quote yourself.</p>
        ) : (
          drafts.map((quote) => {
            const totals = quoteTotals(
              quote.lines.map((line) => ({
                kind: line.kind,
                quantity: Number(line.quantity),
                unitPricePence: line.unitPricePence,
              })),
              quote.depositPercent,
            );
            return (
              <a key={quote.id} href={`/quotes/${quote.id}`} className="card block no-underline">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-ink">{quote.customerName}</p>
                    <p className="text-sm text-muted">
                      {quote.number} · {quote.postcode} · {formatDate(quote.createdAt)}
                    </p>
                  </div>
                  <StatusPill status={quote.status} />
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-muted">{quote.jobDescription}</p>
                <p className="mt-3 font-semibold text-ink">{formatGBP(totals.total)}</p>
              </a>
            );
          })
        )}
      </section>
    </div>
  );
}
