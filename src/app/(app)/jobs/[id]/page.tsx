import { notFound, redirect } from "next/navigation";
import { Flash } from "@/components/flash";
import { buttonPrimary, buttonSecondary, inputClass, labelClass } from "@/components/styles";
import { getCurrentUser } from "@/lib/auth";
import { displayPhone } from "@/lib/customers/match";
import { prisma } from "@/lib/db";
import { dateInputValue, firstParam, formatDate, formatGBP } from "@/lib/format";
import { canMoveJob, invoiceMarker, JOB_STATUSES } from "@/lib/jobs/board";
import { linkJobInvoice, moveJob, setJobPhotoPublic, updateJobService, uploadJobPhotos } from "@/server/job-actions";
import { addJobVisit, deleteJobVisit } from "@/server/diary-actions";
import { billingConfigured, featureAllowed } from "@/lib/billing/plans";
import { isSandboxTrader } from "@/lib/sandbox";
import { createRams } from "@/server/rams-actions";

export const metadata = { title: "Job" };

const titles: Record<(typeof JOB_STATUSES)[number], string> = {
  BOOKED: "Booked",
  IN_PROGRESS: "In progress",
  DONE: "Done",
};

export default async function JobPage({
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
  const job = await prisma.job.findFirst({
    where: { id, traderId: user.trader.id },
    include: {
      customer: true,
      quote: { select: { id: true, number: true, status: true } },
      invoice: { select: { id: true, number: true, status: true, totalPence: true } },
      photos: { orderBy: { createdAt: "asc" } },
      expenses: { orderBy: { createdAt: "desc" }, select: { id: true, supplier: true, totalPence: true, status: true, spentOn: true } },
      rams: { orderBy: { updatedAt: "desc" }, select: { id: true, number: true, title: true, status: true, isTemplate: true } },
      visits: { orderBy: { scheduledFor: "asc" } },
    },
  });
  if (!job) notFound();
  const invoices = await prisma.invoice.findMany({
    where: { traderId: user.trader.id, customerId: job.customerId },
    orderBy: { createdAt: "desc" },
    select: { id: true, number: true, status: true, totalPence: true },
  });
  const marker = invoiceMarker(job.invoice?.status);
  const diaryOn = featureAllowed({
    plan: user.trader.plan,
    feature: "diary",
    sandbox: isSandboxTrader({ slug: user.trader.slug, email: user.email }),
    billingOn: billingConfigured(),
  });
  const moves = JOB_STATUSES.filter((status) => canMoveJob(job.status, status));

  return (
    <div className="mx-auto grid max-w-2xl gap-5">
      <div>
        <p className="text-sm font-semibold text-muted">{titles[job.status]}</p>
        <h1 className="font-serif text-4xl">{job.title}</h1>
        <p className="mt-2 text-sm text-muted">
          <a href={`/customers/${job.customer.id}`}>{job.customer.name}</a>
          {job.customer.phone ? ` · ${displayPhone(job.customer.phone)}` : ""}
          {job.customer.email ? ` · ${job.customer.email}` : ""}
        </p>
        {job.address || job.postcode ? (
          <p className="mt-1 text-sm text-muted">{[job.address, job.postcode].filter(Boolean).join(", ")}</p>
        ) : null}
      </div>
      <Flash error={firstParam(query.error)} notice={firstParam(query.notice)} />
      <div className="flex flex-wrap gap-2 text-sm font-semibold">
        {marker === "paid" ? <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-950">Paid</span> : null}
        {marker === "invoiced" ? <span className="rounded-full bg-sky-100 px-3 py-1 text-sky-950">Invoiced</span> : null}
        {job.invoice?.status === "DRAFT" ? (
          <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-950">Draft invoice, not sent</span>
        ) : null}
        {job.quote ? <a href={`/quotes/${job.quote.id}`}>Quote {job.quote.number}</a> : null}
        {job.invoice ? <a href={`/invoices/${job.invoice.id}`}>Invoice {job.invoice.number}</a> : null}
      </div>
      <section className="grid gap-2 sm:grid-cols-2">
        {moves.map((status) => (
          <form key={status} action={moveJob}>
            <input type="hidden" name="jobId" value={job.id} />
            <input type="hidden" name="status" value={status} />
            <button className={`${status === "DONE" || status === "IN_PROGRESS" ? buttonPrimary : buttonSecondary} w-full`} type="submit">
              Mark {titles[status].toLowerCase()}
            </button>
          </form>
        ))}
      </section>
      <section className="card grid gap-3">
        <h2 className="font-serif text-2xl">Visits</h2>
        <p className="text-sm leading-6 text-muted">
          Dates in the <a href="/diary">diary</a>. They are not sent to the customer. A repeating service further down is a reminder, not a visit.
        </p>
        {job.visits.length === 0 ? <p className="text-sm text-muted">No visit booked yet.</p> : null}
        {job.visits.map((visit) => (
          <div key={visit.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <p>
              {formatDate(visit.scheduledFor)}
              {visit.scheduledTime ? ` at ${visit.scheduledTime}` : ""}
              {visit.note ? ` · ${visit.note}` : ""}
            </p>
            {diaryOn ? (
              <form action={deleteJobVisit}>
                <input type="hidden" name="visitId" value={visit.id} />
                <input type="hidden" name="returnTo" value={`/jobs/${job.id}`} />
                <button className={buttonSecondary} type="submit">Remove</button>
              </form>
            ) : null}
          </div>
        ))}
        {diaryOn ? (
          <form action={addJobVisit} className="grid gap-3">
            <input type="hidden" name="jobId" value={job.id} />
            <input type="hidden" name="returnTo" value={`/jobs/${job.id}`} />
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
              <input className={inputClass} name="note" placeholder="Optional" />
            </label>
            <button className={`${buttonSecondary} w-full sm:w-auto`} type="submit">Add visit</button>
          </form>
        ) : (
          <p className="text-sm leading-6">The diary is on the Trade plan. <a href="/billing">Open Plans</a>.</p>
        )}
      </section>
      <form action={updateJobService} className="card grid gap-3">
        <h2 className="font-serif text-2xl">Repeating service</h2>
        <p className="text-sm leading-6 text-muted">
          Use this for an annual boiler service or a gas safety check. Leave the date blank and marking the job done sets it 12 months later, or choose the date yourself. A reminder is queued before it is due. It invites the customer to enquire and does not book the visit. You can also keep a reminder on the <a href={`/customers/${job.customer.id}`}>customer</a> when the visit itself does not repeat.
        </p>
        <input type="hidden" name="jobId" value={job.id} />
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" name="recurring" defaultChecked={job.recurring} />
          This job repeats
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={labelClass}>
            Every (months)
            <input className={inputClass} name="intervalMonths" type="number" min={1} max={60} defaultValue={job.intervalMonths} required />
          </label>
          <label className={labelClass}>
            Next due
            <input className={inputClass} name="serviceDueAt" type="date" defaultValue={dateInputValue(job.serviceDueAt)} />
          </label>
        </div>
        {job.recurring && job.serviceDueAt ? (
          <p className="text-sm text-muted">Due {formatDate(job.serviceDueAt)}.</p>
        ) : null}
        <button className={`${buttonSecondary} w-full sm:w-auto`} type="submit">Save service</button>
      </form>
      <form action={linkJobInvoice} className="card grid gap-3">
        <h2 className="font-serif text-2xl">Invoice</h2>
        <p className="text-sm leading-6 text-muted">
          Paid and Invoiced come from the linked invoice. A draft stays private until you approve it.
        </p>
        <input type="hidden" name="jobId" value={job.id} />
        <label className={labelClass}>
          Linked invoice
          <select className={inputClass} name="invoiceId" defaultValue={job.invoiceId ?? ""}>
            <option value="">None</option>
            {invoices.map((invoice) => (
              <option key={invoice.id} value={invoice.id}>
                {invoice.number} · {invoice.status.toLowerCase()} · {formatGBP(invoice.totalPence)}
              </option>
            ))}
          </select>
        </label>
        <button className={`${buttonSecondary} w-full sm:w-auto`} type="submit">Save link</button>
      </form>
      <section className="grid gap-3">
        <h2 className="font-serif text-2xl">RAMS</h2>
        <p className="text-sm leading-6 text-muted">
          Draft a risk assessment and method statement from this job. It uses the checked library for your trade. Nothing is sent to the client until you forward the PDF yourself.
        </p>
        {job.rams.filter((rams) => !rams.isTemplate).map((rams) => (
          <a key={rams.id} href={`/rams/${rams.id}`} className="card block no-underline">
            <p className="font-semibold text-ink">
              {rams.number} · {rams.title}
            </p>
            <p className="mt-1 text-sm text-muted">{rams.status === "SIGNED" || rams.status === "ISSUED" ? "Fully signed" : rams.status === "AWAITING_SIGNATURES" ? "Awaiting signatures" : "Draft"}</p>
          </a>
        ))}
        <form action={createRams}>
          <input type="hidden" name="jobId" value={job.id} />
          <input type="hidden" name="returnJob" value={job.id} />
          <button className={buttonPrimary} type="submit">
            Draft a RAMS for this job
          </button>
        </form>
      </section>
      <section className="grid gap-3">
        <h2 className="font-serif text-2xl">Receipts</h2>
        <p className="text-sm leading-6 text-muted">
          Purchase receipts linked to this job. The figures are a record for you and your accountant. They are not sent to the customer and they are not filed with HMRC.
        </p>
        {job.expenses.length === 0 ? <p className="card text-sm text-muted">No receipts linked to this job yet.</p> : null}
        {job.expenses.map((expense) => (
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
        <h2 className="font-serif text-2xl">Photos</h2>
        <p className="text-sm leading-6 text-muted">
          Before and after shots stay on this job. Photos the customer sent with the enquiry are copied here when the job is booked. They are reduced in size when you upload them. Tick “Show on your page” to put a photo on your public site.
        </p>
        {job.photos.length === 0 ? <p className="card text-sm text-muted">No photos yet.</p> : null}
        <div className="grid grid-cols-2 gap-3">
          {job.photos.map((photo) => (
            <figure key={photo.id} className="overflow-hidden rounded-2xl border border-sand bg-white">
              <img src={`/api/job-photos/${photo.id}`} alt={photo.kind === "BEFORE" ? "Before the job" : "After the job"} className="aspect-[4/3] w-full object-cover" />
              <figcaption className="grid gap-2 px-3 py-2 text-sm">
                <span className="font-semibold">{photo.kind === "BEFORE" ? "Before" : "After"}</span>
                <form action={setJobPhotoPublic} className="grid gap-2">
                  <input type="hidden" name="photoId" value={photo.id} />
                  <label className="flex items-start gap-2 font-semibold">
                    <input type="checkbox" name="showOnWebsite" defaultChecked={photo.showOnWebsite} />
                    Show on your page
                  </label>
                  <button className={buttonSecondary} type="submit">Save</button>
                </form>
              </figcaption>
            </figure>
          ))}
        </div>
        <form action={uploadJobPhotos} className="card grid gap-3">
          <input type="hidden" name="jobId" value={job.id} />
          <label className={labelClass}>
            These photos are
            <select className={inputClass} name="kind" defaultValue="BEFORE">
              <option value="BEFORE">Before</option>
              <option value="AFTER">After</option>
            </select>
          </label>
          <label className={labelClass}>
            From your camera or photo library
            <input className={`${inputClass} file:mr-3 file:rounded-lg file:border-0 file:bg-sand file:px-3 file:py-2 file:text-sm file:font-semibold`} type="file" name="photos" accept="image/*" multiple required />
          </label>
          <button className={`${buttonPrimary} w-full sm:w-auto`} type="submit">Add photos</button>
        </form>
      </section>
    </div>
  );
}
