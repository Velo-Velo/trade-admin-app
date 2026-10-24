import { redirect } from "next/navigation";
import { Flash } from "@/components/flash";
import { buttonPrimary, inputClass, labelClass } from "@/components/styles";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { firstParam } from "@/lib/format";
import { RAMS_DISCLAIMER } from "@/lib/rams/disclaimer";
import { RAMS_TRADES, defaultRamsTrade, ramsTradeLabel } from "@/lib/rams/library";
import { createRams } from "@/server/rams-actions";

export const metadata = { title: "New RAMS" };

export default async function NewRamsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string; job?: string; customer?: string; template?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user?.trader) redirect("/onboarding");
  const query = await searchParams;
  const [jobs, customers, templates] = await Promise.all([
    prisma.job.findMany({
      where: { traderId: user.trader.id },
      orderBy: { updatedAt: "desc" },
      take: 40,
      include: { customer: { select: { name: true } } },
    }),
    prisma.customer.findMany({
      where: { traderId: user.trader.id },
      orderBy: { name: "asc" },
      take: 40,
      select: { id: true, name: true, postcode: true },
    }),
    prisma.rams.findMany({
      where: { traderId: user.trader.id, isTemplate: true },
      orderBy: { updatedAt: "desc" },
      select: { id: true, number: true, title: true, trade: true },
    }),
  ]);
  const trade = defaultRamsTrade(user.trader.trade);

  return (
    <div className="mx-auto grid max-w-2xl gap-5">
      <div>
        <h1 className="font-serif text-4xl">New RAMS</h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          Pick a job and the address, client and scope come from it. Or start from a customer, a template, or a blank description. The library fills the hazards. You can edit every line on the next screen.
        </p>
      </div>
      <Flash error={firstParam(query.error)} notice={firstParam(query.notice)} />
      <aside className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">{RAMS_DISCLAIMER}</aside>
      <form action={createRams} className="card grid gap-3">
        <label className={labelClass}>
          Job
          <select className={inputClass} name="jobId" defaultValue={query.job || ""}>
            <option value="">No job yet</option>
            {jobs.map((job) => (
              <option key={job.id} value={job.id}>
                {job.title} · {job.customer.name}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          Customer, if there is no job
          <select className={inputClass} name="customerId" defaultValue={query.customer || ""}>
            <option value="">No customer</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
                {customer.postcode ? ` · ${customer.postcode}` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          Template
          <select className={inputClass} name="templateId" defaultValue={query.template || ""}>
            <option value="">Start from the library</option>
            {templates.map((item) => (
              <option key={item.id} value={item.id}>
                {item.number} · {item.title} · {ramsTradeLabel(item.trade)}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          Trade
          <select className={inputClass} name="trade" defaultValue={trade}>
            {RAMS_TRADES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <p className="text-sm text-muted">
          A template keeps its own wording. The trade above is used when you start from the library. If you pick a job, its address and client replace anything you type here.
        </p>
        <label className={labelClass}>
          Scope of work
          <textarea
            className={inputClass}
            name="scope"
            rows={4}
            placeholder="Replace the outside tap, isolate the supply, and check for leaks. Ladder needed."
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={labelClass}>
            Site address
            <input className={inputClass} name="siteAddress" placeholder="Used when there is no job" />
          </label>
          <label className={labelClass}>
            Postcode
            <input className={inputClass} name="sitePostcode" />
          </label>
          <label className={labelClass}>
            Client or main contractor
            <input className={inputClass} name="clientName" />
          </label>
          <label className={labelClass}>
            They are the
            <select className={inputClass} name="clientRole" defaultValue="Client">
              <option>Client</option>
              <option>Domestic client</option>
              <option>Main contractor</option>
            </select>
          </label>
        </div>
        <button className={buttonPrimary} type="submit">
          Draft the RAMS
        </button>
      </form>
    </div>
  );
}
