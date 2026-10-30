import { redirect } from "next/navigation";
import { Flash } from "@/components/flash";
import { buttonPrimary, buttonSecondary, inputClass, labelClass } from "@/components/styles";
import { getCurrentUser } from "@/lib/auth";
import { isServiceDueSoon } from "@/lib/chasers/plan";
import { ReminderList, type ReminderListItem } from "@/components/reminder-list";
import { displayPhone } from "@/lib/customers/match";
import { prisma } from "@/lib/db";
import { firstParam, formatDate } from "@/lib/format";
import { invoiceMarker } from "@/lib/jobs/board";
import { ensureBookedJobsForTrader } from "@/lib/jobs/ensure";
import { createJob, moveJob } from "@/server/job-actions";

export const metadata = { title: "Jobs" };

const columns = [
  { status: "BOOKED" as const, title: "Booked", forward: "IN_PROGRESS" as const, forwardLabel: "Mark in progress" },
  {
    status: "IN_PROGRESS" as const,
    title: "In progress",
    back: "BOOKED" as const,
    backLabel: "Mark booked",
    forward: "DONE" as const,
    forwardLabel: "Mark done",
  },
  { status: "DONE" as const, title: "Done", back: "IN_PROGRESS" as const, backLabel: "Mark in progress" },
];

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user?.trader) redirect("/onboarding");
  const query = await searchParams;
  await ensureBookedJobsForTrader(prisma, user.trader.id);
  const now = new Date();
  const jobs = await prisma.job.findMany({
    where: { traderId: user.trader.id },
    orderBy: { updatedAt: "desc" },
    include: {
      customer: true,
      invoice: { select: { status: true, number: true } },
      _count: { select: { photos: true, rams: true } },
    },
  });
  const reminders = await prisma.serviceReminder.findMany({
    where: { traderId: user.trader.id, enabled: true },
    include: { customer: { select: { name: true } } },
  });
  const remindWeeks = user.trader.serviceRemindWeeks;
  const dueSoon: ReminderListItem[] = [
    ...jobs.flatMap((job) =>
      job.serviceDueAt && isServiceDueSoon(job, now, remindWeeks)
        ? [{ id: job.id, title: job.title, customerName: job.customer.name, dueAt: job.serviceDueAt, href: `/jobs/${job.id}` }]
        : [],
    ),
    ...reminders.flatMap((reminder) =>
      isServiceDueSoon({ recurring: true, serviceDueAt: reminder.dueAt }, now, remindWeeks)
        ? [{ id: reminder.id, title: reminder.title, customerName: reminder.customer.name, dueAt: reminder.dueAt, href: `/customers/${reminder.customerId}` }]
        : [],
    ),
  ].sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="font-serif text-4xl">Jobs</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          Tap a button to move a job. An accepted quote lands in Booked. Invoiced and Paid follow the invoice, and nothing is sent to the customer from this board.
        </p>
      </div>
      <Flash error={firstParam(query.error)} notice={firstParam(query.notice)} />
      <section className="grid gap-3">
        <h2 className="font-serif text-2xl">Due soon</h2>
        <ReminderList
          items={dueSoon}
          now={now}
          remindWeeks={remindWeeks}
          empty={`No repeating services or customer reminders are due in the next ${remindWeeks} weeks.`}
        />
      </section>
      <form action={createJob} className="card grid gap-3">
        <h2 className="font-serif text-2xl">Book a job</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={labelClass}>
            Customer
            <input className={inputClass} name="name" required placeholder="Name" />
          </label>
          <label className={labelClass}>
            Phone or email
            <input className={inputClass} name="contact" placeholder="Optional" />
          </label>
          <label className={labelClass}>
            Job
            <input className={inputClass} name="title" required placeholder="Replace the kitchen tap" />
          </label>
          <label className={labelClass}>
            Postcode
            <input className={inputClass} name="postcode" placeholder="Postcode" />
          </label>
        </div>
        <label className={labelClass}>
          Address
          <input className={inputClass} name="address" placeholder="Optional" />
        </label>
        <button className={`${buttonPrimary} w-full sm:w-auto`} type="submit">Add to Booked</button>
      </form>
      <div className="grid gap-4 lg:grid-cols-3">
        {columns.map((column) => {
          const cards = jobs.filter((job) => job.status === column.status);
          return (
            <section key={column.status} className="grid content-start gap-3">
              <h2 className="font-serif text-2xl">
                {column.title} <span className="text-base text-muted">{cards.length}</span>
              </h2>
              {cards.length === 0 ? <p className="card text-sm text-muted">Nothing in this column.</p> : null}
              {cards.map((job) => {
                const marker = invoiceMarker(job.invoice?.status);
                return (
                  <article key={job.id} className="card grid gap-3">
                    <div>
                      <p className="font-semibold">
                        <a href={`/jobs/${job.id}`}>{job.title}</a>
                      </p>
                      <p className="mt-1 text-sm text-muted">
                        <a href={`/customers/${job.customer.id}`}>{job.customer.name}</a>
                        {job.postcode ? ` · ${job.postcode}` : ""}
                        {job.customer.phone ? ` · ${displayPhone(job.customer.phone)}` : ""}
                      </p>
                      {job.recurring && job.serviceDueAt ? (
                        <p className="mt-1 text-sm text-muted">Service due {formatDate(job.serviceDueAt)}</p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs font-semibold">
                      {marker === "paid" ? <span className="rounded-full bg-emerald-100 px-2 py-1 text-emerald-950">Paid</span> : null}
                      {marker === "invoiced" ? <span className="rounded-full bg-sky-100 px-2 py-1 text-sky-950">Invoiced</span> : null}
                      {job.invoice?.status === "DRAFT" ? (
                        <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-950">Draft invoice, not sent</span>
                      ) : null}
                      {job._count.photos > 0 ? (
                        <span className="rounded-full bg-sand px-2 py-1">{job._count.photos} photos</span>
                      ) : null}
                      {job._count.rams > 0 ? (
                        <a href={`/rams?job=${job.id}`} className="rounded-full bg-sand px-2 py-1 no-underline">
                          RAMS
                        </a>
                      ) : null}
                    </div>
                    <div className="grid gap-2">
                      {"back" in column && column.back ? (
                        <form action={moveJob}>
                          <input type="hidden" name="jobId" value={job.id} />
                          <input type="hidden" name="status" value={column.back} />
                          <input type="hidden" name="returnTo" value="/jobs" />
                          <button className={`${buttonSecondary} w-full`} type="submit">{column.backLabel}</button>
                        </form>
                      ) : null}
                      {"forward" in column && column.forward ? (
                        <form action={moveJob}>
                          <input type="hidden" name="jobId" value={job.id} />
                          <input type="hidden" name="status" value={column.forward} />
                          <input type="hidden" name="returnTo" value="/jobs" />
                          <button className={`${buttonPrimary} w-full`} type="submit">{column.forwardLabel}</button>
                        </form>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </section>
          );
        })}
      </div>
    </div>
  );
}
