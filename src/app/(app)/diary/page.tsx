import { redirect } from "next/navigation";
import { Flash } from "@/components/flash";
import { buttonPrimary, buttonSecondary, inputClass, labelClass } from "@/components/styles";
import { getCurrentUser } from "@/lib/auth";
import { billingConfigured, featureAllowed, upgradeMessage } from "@/lib/billing/plans";
import { prisma } from "@/lib/db";
import {
  calendarCells,
  diaryEntries,
  entriesByDay,
  jobsWithoutVisits,
  parseMonthKey,
  shiftMonth,
} from "@/lib/diary/month";
import { firstParam, formatDate } from "@/lib/format";
import { isSandboxTrader } from "@/lib/sandbox";
import { addJobVisit, deleteJobVisit } from "@/server/diary-actions";

export const metadata = { title: "Diary" };

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default async function DiaryPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string; month?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user?.trader) redirect("/onboarding");
  const query = await searchParams;
  const sandbox = isSandboxTrader({ slug: user.trader.slug, email: user.email });
  const allowed = featureAllowed({
    plan: user.trader.plan,
    feature: "diary",
    sandbox,
    billingOn: billingConfigured(),
  });
  const view = parseMonthKey(firstParam(query.month), new Date());

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="font-serif text-4xl">Diary</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          Visits you have booked on a job. A service reminder shows on its due date and does not book the visit. Nothing here is sent to the customer.
        </p>
      </div>
      <Flash error={firstParam(query.error)} notice={firstParam(query.notice)} />
      {allowed ? (
        <DiaryMonth traderId={user.trader.id} monthKey={view.key} />
      ) : (
        <p className="card text-sm leading-6">
          {upgradeMessage("diary")} <a href="/billing">Open Plans</a>
        </p>
      )}
    </div>
  );
}

async function DiaryMonth({ traderId, monthKey }: { traderId: string; monthKey: string }) {
  const view = parseMonthKey(monthKey, new Date());
  const previous = shiftMonth(view, -1);
  const next = shiftMonth(view, 1);
  const [jobs, reminders] = await Promise.all([
    prisma.job.findMany({
      where: { traderId },
      orderBy: { updatedAt: "desc" },
      include: {
        customer: { select: { name: true } },
        visits: { orderBy: { scheduledFor: "asc" } },
      },
    }),
    prisma.serviceReminder.findMany({
      where: { traderId, enabled: true },
      include: { customer: { select: { name: true } } },
    }),
  ]);
  const entries = diaryEntries({
    view,
    visits: jobs.flatMap((job) =>
      job.visits.map((visit) => ({
        id: visit.id,
        scheduledFor: visit.scheduledFor,
        scheduledTime: visit.scheduledTime,
        note: visit.note,
        jobId: job.id,
        jobTitle: job.title,
        customerName: job.customer.name,
      })),
    ),
    services: [
      ...jobs.flatMap((job) =>
        job.recurring && job.serviceDueAt
          ? [{
              id: `job-service-${job.id}`,
              title: job.title,
              customerName: job.customer.name,
              dueAt: job.serviceDueAt,
              href: `/jobs/${job.id}`,
              detail: "Repeating service on this job. Not a booked visit.",
            }]
          : [],
      ),
      ...reminders.map((reminder) => ({
        id: `reminder-${reminder.id}`,
        title: reminder.title,
        customerName: reminder.customer.name,
        dueAt: reminder.dueAt,
        href: `/customers/${reminder.customerId}`,
        detail: "Customer reminder. Not a booked visit.",
      })),
    ],
  });
  const byDay = entriesByDay(entries);
  const cells = calendarCells(view);
  const unscheduled = jobsWithoutVisits(jobs.map((job) => ({ ...job, visitCount: job.visits.length, customerName: job.customer.name })));
  const returnTo = `/diary?month=${view.key}`;

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <a href={`/diary?month=${previous.key}`} className="text-sm font-semibold">Previous</a>
        <h2 className="font-serif text-2xl">{view.label}</h2>
        <a href={`/diary?month=${next.key}`} className="text-sm font-semibold">Next</a>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-muted">
        {WEEKDAYS.map((day) => <div key={day}>{day}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell) => {
          const count = byDay.get(cell.iso)?.length ?? 0;
          const day = Number(cell.iso.slice(-2));
          const className = `min-h-12 rounded-xl border px-1 py-1 text-xs ${cell.inMonth ? "border-sand bg-white text-ink" : "border-transparent text-muted"}`;
          if (!cell.inMonth || count === 0) {
            return <div key={cell.iso} className={className}>{day}</div>;
          }
          return (
            <a key={cell.iso} href={`#day-${cell.iso}`} className={`${className} no-underline`}>
              <span className="block">{day}</span>
              <span className="mt-1 block h-1.5 w-1.5 rounded-full bg-pine" />
            </a>
          );
        })}
      </div>
      {[...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([iso, dayEntries]) => (
        <section key={iso} id={`day-${iso}`} className="grid gap-3">
          <h3 className="font-serif text-2xl">{formatDate(new Date(`${iso}T00:00:00.000Z`))}</h3>
          {dayEntries.map((entry) => (
            <article key={entry.id} className="card grid gap-2">
              <p className="text-sm font-semibold text-muted">{entry.kind === "visit" ? "Visit" : "Service due"}{entry.time ? ` · ${entry.time}` : ""}</p>
              <p className="font-semibold"><a href={entry.href}>{entry.title}</a></p>
              <p className="text-sm text-muted">{entry.customerName}{entry.detail ? ` · ${entry.detail}` : ""}</p>
              {entry.kind === "visit" ? (
                <form action={deleteJobVisit}>
                  <input type="hidden" name="visitId" value={entry.id} />
                  <input type="hidden" name="returnTo" value={returnTo} />
                  <button className={buttonSecondary} type="submit">Remove visit</button>
                </form>
              ) : null}
            </article>
          ))}
        </section>
      ))}
      {entries.length === 0 ? <p className="card text-sm text-muted">Nothing booked in {view.label}. Service dates in another month are on the next or previous page.</p> : null}
      <section className="grid gap-3">
        <h2 className="font-serif text-2xl">Not in the diary</h2>
        {unscheduled.length === 0 ? <p className="text-sm text-muted">Every open job has a visit, or there are no open jobs.</p> : null}
        <ul className="grid gap-2 text-sm">
          {unscheduled.map((job) => (
            <li key={job.id}><a href={`/jobs/${job.id}`}>{job.title}</a> · {job.customerName}</li>
          ))}
        </ul>
      </section>
      {jobs.length === 0 ? <p className="text-sm text-muted">Book a job first, then add the visit here.</p> : (
      <form action={addJobVisit} className="card grid gap-3">
        <h2 className="font-serif text-2xl">Add a visit</h2>
        <input type="hidden" name="returnTo" value={returnTo} />
        <label className={labelClass}>
          Job
          <select className={inputClass} name="jobId" required defaultValue={unscheduled[0]?.id ?? jobs[0]?.id ?? ""}>
            {jobs.map((job) => (
              <option key={job.id} value={job.id}>{job.title} · {job.customer.name}</option>
            ))}
          </select>
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={labelClass}>
            Date
            <input className={inputClass} name="scheduledFor" type="date" required />
          </label>
          <label className={labelClass}>
            Time
            <input className={inputClass} name="scheduledTime" type="time" />
          </label>
        </div>
        <label className={labelClass}>
          Note
          <input className={inputClass} name="note" placeholder="Optional. The customer does not see this." />
        </label>
        <button className={`${buttonPrimary} w-full sm:w-auto`} type="submit">Add to the diary</button>
      </form>
      )}
    </>
  );
}
