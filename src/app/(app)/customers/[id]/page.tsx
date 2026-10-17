import { notFound, redirect } from "next/navigation";
import { Flash } from "@/components/flash";
import { StatusPill } from "@/components/status-pill";
import { buttonSecondary, inputClass, labelClass } from "@/components/styles";
import { getCurrentUser } from "@/lib/auth";
import { displayPhone } from "@/lib/customers/match";
import { prisma } from "@/lib/db";
import { firstParam, formatDate, formatGBP } from "@/lib/format";
import { invoiceMarker } from "@/lib/jobs/board";
import { updateCustomerDetails } from "@/server/job-actions";

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
      quotes: { orderBy: { createdAt: "desc" } },
      invoices: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!customer) notFound();

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
            </a>
          );
        })}
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
