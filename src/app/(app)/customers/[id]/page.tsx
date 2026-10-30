import { notFound, redirect } from "next/navigation";
import { Flash } from "@/components/flash";
import { StatusPill } from "@/components/status-pill";
import { buttonPrimary, buttonSecondary, inputClass, labelClass } from "@/components/styles";
import { getCurrentUser } from "@/lib/auth";
import { dueAfterJobDate } from "@/lib/chasers/plan";
import { displayPhone } from "@/lib/customers/match";
import { prisma } from "@/lib/db";
import { dateInputValue, firstParam, formatDate, formatGBP } from "@/lib/format";
import { invoiceMarker } from "@/lib/jobs/board";
import { updateCustomerDetails } from "@/server/job-actions";
import { saveCustomerCis } from "@/server/cis-actions";
import { deleteCustomerReminder, markReminderDone, saveCustomerReminder } from "@/server/reminder-actions";

export const metadata = { title: "Customer" };

const jobLabel = { BOOKED: "Booked", IN_PROGRESS: "In progress", DONE: "Done" };

export default async function CustomerPage({
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
  const customer = await prisma.customer.findFirst({
    where: { id, traderId: user.trader.id },
    include: {
      jobs: { orderBy: { createdAt: "desc" }, include: { invoice: { select: { status: true } } } },
      serviceReminders: { orderBy: { dueAt: "asc" } },
      rams: { where: { isTemplate: false }, orderBy: { updatedAt: "desc" }, select: { id: true, number: true, title: true, status: true } },
      quotes: { orderBy: { createdAt: "desc" } },
      invoices: { orderBy: { createdAt: "desc" } },
      expenses: { orderBy: { createdAt: "desc" }, select: { id: true, supplier: true, totalPence: true, status: true, spentOn: true } },
    },
  });
  if (!customer) notFound();
  const latestDone = customer.jobs
    .map((job) => job.doneAt)
    .filter((date): date is Date => Boolean(date))
    .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
  const suggestedDue = dueAfterJobDate(latestDone ?? new Date(), 12);

  return (
    <div className="mx-auto grid max-w-2xl gap-5">
      <div>
        <h1 className="font-serif text-4xl">{customer.name}</h1>
        <p className="mt-2 text-sm text-muted">
          {[displayPhone(customer.phone), customer.email, customer.postcode].filter(Boolean).join(" · ") || "Add a phone, email or postcode below."}
        </p>
        {customer.address ? <p className="mt-1 text-sm text-muted">{customer.address}</p> : null}
      </div>
      <Flash error={firstParam(query.error)} notice={firstParam(query.notice)} />
      <form action={updateCustomerDetails} className="card grid gap-3">
        <h2 className="font-serif text-2xl">Details</h2>
        <input type="hidden" name="customerId" value={customer.id} />
        <label className={labelClass}>
          Name
          <input className={inputClass} name="name" defaultValue={customer.name} required />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={labelClass}>
            Phone
            <input className={inputClass} name="phone" defaultValue={displayPhone(customer.phone)} />
          </label>
          <label className={labelClass}>
            Email
            <input className={inputClass} name="email" defaultValue={customer.email} />
          </label>
          <label className={labelClass}>
            Postcode
            <input className={inputClass} name="postcode" defaultValue={customer.postcode} />
          </label>
          <label className={labelClass}>
            Address
            <input className={inputClass} name="address" defaultValue={customer.address} />
          </label>
        </div>
        <button className={`${buttonSecondary} w-full sm:w-auto`} type="submit">Save details</button>
      </form>
      <form action={saveCustomerCis} className="card grid gap-3">
        <h2 className="font-serif text-2xl">CIS</h2>
        <p className="text-sm leading-6 text-muted">
          Tick this when the customer is a contractor who deducts CIS from your invoice. Domestic customers stay unticked. Leave the rate blank to use the status on Your page. The deduction is recorded on the invoice only on the Splitstick bundle, and only after you approve that invoice.
        </p>
        <input type="hidden" name="customerId" value={customer.id} />
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" name="deductsCis" defaultChecked={customer.deductsCis} />
          This customer deducts CIS
        </label>
        <label className={labelClass}>
          Rate for this customer
          <select className={inputClass} name="cisRateOverride" defaultValue={customer.cisRateOverride === null ? "" : String(customer.cisRateOverride)}>
            <option value="">Use my status</option>
            <option value="0">Gross — 0%</option>
            <option value="20">Standard — 20%</option>
            <option value="30">Higher — 30%</option>
          </select>
        </label>
        <button className={`${buttonSecondary} w-full sm:w-auto`} type="submit">Save CIS setting</button>
      </form>
      <section className="grid gap-3">
        <h2 className="font-serif text-2xl">Service reminders</h2>
        <p className="text-sm leading-6 text-muted">
          {latestDone
            ? `A yearly reminder is usually 12 months after the last finished job (${formatDate(latestDone)}). `
            : "A yearly reminder is usually 12 months from today. "}
          Use this for a boiler service or a gas safety check that is not already a repeating job. When it is due, it shows in Follow-ups and on the dashboard. The customer is not messaged until you send it.
        </p>
        {customer.serviceReminders.map((reminder) => (
          <div key={reminder.id} className="card grid gap-3">
            <form action={saveCustomerReminder} className="grid gap-3">
              <input type="hidden" name="customerId" value={customer.id} />
              <input type="hidden" name="reminderId" value={reminder.id} />
              <label className={labelClass}>
                Reminder
                <input className={inputClass} name="title" defaultValue={reminder.title} required />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className={labelClass}>
                  Every (months)
                  <input className={inputClass} name="intervalMonths" type="number" min={1} max={60} defaultValue={reminder.intervalMonths} required />
                </label>
                <label className={labelClass}>
                  Due
                  <input className={inputClass} name="dueAt" type="date" defaultValue={dateInputValue(reminder.dueAt)} required />
                </label>
              </div>
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input type="checkbox" name="enabled" defaultChecked={reminder.enabled} />
                Remind me when this is due
              </label>
              <p className="text-sm text-muted">Due {formatDate(reminder.dueAt)}.</p>
              <button className={`${buttonSecondary} w-full sm:w-auto`} type="submit">Save</button>
            </form>
            <div className="flex flex-wrap gap-2">
              <form action={markReminderDone}>
                <input type="hidden" name="customerId" value={customer.id} />
                <input type="hidden" name="reminderId" value={reminder.id} />
                <button className={buttonSecondary} type="submit">Mark done and set the next date</button>
              </form>
              <form action={deleteCustomerReminder}>
                <input type="hidden" name="customerId" value={customer.id} />
                <input type="hidden" name="reminderId" value={reminder.id} />
                <button className={buttonSecondary} type="submit">Remove</button>
              </form>
            </div>
          </div>
        ))}
        <form action={saveCustomerReminder} className="card grid gap-3">
          <h3 className="font-serif text-xl">Add a reminder</h3>
          <input type="hidden" name="customerId" value={customer.id} />
          <label className={labelClass}>
            What is due
            <input className={inputClass} name="title" placeholder="Gas safety check" required />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={labelClass}>
              Every (months)
              <input className={inputClass} name="intervalMonths" type="number" min={1} max={60} defaultValue={12} required />
            </label>
            <label className={labelClass}>
              Due
              <input className={inputClass} name="dueAt" type="date" defaultValue={dateInputValue(suggestedDue)} required />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" name="enabled" defaultChecked />
            Remind me when this is due
          </label>
          <button className={`${buttonPrimary} w-full sm:w-auto`} type="submit">Save reminder</button>
        </form>
      </section>
      <section className="grid gap-3">
        <h2 className="font-serif text-2xl">Jobs</h2>
        {customer.jobs.length === 0 ? <p className="card text-sm text-muted">No jobs yet. An accepted quote creates one.</p> : null}
        {customer.jobs.map((job) => {
          const marker = invoiceMarker(job.invoice?.status);
          return (
            <a key={job.id} href={`/jobs/${job.id}`} className="card block no-underline">
              <div className="flex items-start justify-between gap-3">
                <p className="font-semibold text-ink">{job.title}</p>
                <span className="text-sm font-semibold text-muted">{jobLabel[job.status]}</span>
              </div>
              {marker ? <p className="mt-1 text-sm text-muted">{marker === "paid" ? "Paid" : "Invoiced"}</p> : null}
              {job.recurring && job.serviceDueAt ? (
                <p className="mt-1 text-sm text-muted">Service due {formatDate(job.serviceDueAt)}</p>
              ) : null}
            </a>
          );
        })}
      </section>
      <section className="grid gap-3">
        <h2 className="font-serif text-2xl">RAMS</h2>
        {customer.rams.length === 0 ? (
          <p className="card text-sm text-muted">
            No RAMS for this customer yet. <a href={`/rams/new?customer=${customer.id}`}>Start one</a>.
          </p>
        ) : (
          customer.rams.map((rams) => (
            <a key={rams.id} href={`/rams/${rams.id}`} className="card block no-underline">
              <p className="font-semibold text-ink">
                {rams.number} · {rams.title}
              </p>
              <p className="mt-1 text-sm text-muted">{rams.status === "SIGNED" || rams.status === "ISSUED" ? "Fully signed" : rams.status === "AWAITING_SIGNATURES" ? "Awaiting signatures" : "Draft"}</p>
            </a>
          ))
        )}
      </section>
      <section className="grid gap-3">
        <h2 className="font-serif text-2xl">Receipts</h2>
        {customer.expenses.length === 0 ? <p className="card text-sm text-muted">No receipts linked to this customer yet.</p> : null}
        {customer.expenses.map((expense) => (
          <a key={expense.id} href={`/receipts/${expense.id}`} className="card block no-underline">
            <p className="font-semibold text-ink">{expense.supplier || "Supplier not entered"}</p>
            <p className="mt-1 text-sm text-muted">
              {expense.status === "CONFIRMED" ? "Confirmed" : "Needs review"}
              {expense.spentOn ? ` · ${formatDate(expense.spentOn)}` : ""}
              {expense.totalPence != null ? ` · ${formatGBP(expense.totalPence)}` : ""}
            </p>
          </a>
        ))}
      </section>
      <section className="grid gap-3">
        <h2 className="font-serif text-2xl">Quotes</h2>
        {customer.quotes.length === 0 ? <p className="card text-sm text-muted">No quotes yet.</p> : null}
        {customer.quotes.map((quote) => (
          <a key={quote.id} href={`/quotes/${quote.id}`} className="card flex items-start justify-between gap-3 no-underline">
            <div>
              <p className="font-semibold text-ink">{quote.number}</p>
              <p className="mt-1 text-sm text-muted">{formatDate(quote.createdAt)}</p>
            </div>
            <StatusPill status={quote.status} />
          </a>
        ))}
      </section>
      <section className="grid gap-3">
        <h2 className="font-serif text-2xl">Invoices</h2>
        {customer.invoices.length === 0 ? <p className="card text-sm text-muted">No invoices yet.</p> : null}
        {customer.invoices.map((invoice) => (
          <a key={invoice.id} href={`/invoices/${invoice.id}`} className="card flex items-start justify-between gap-3 no-underline">
            <div>
              <p className="font-semibold text-ink">{invoice.number}</p>
              <p className="mt-1 text-sm text-muted">{formatGBP(invoice.totalPence)} · due {formatDate(invoice.dueAt)}</p>
            </div>
            <StatusPill status={invoice.status} />
          </a>
        ))}
      </section>
    </div>
  );
}
