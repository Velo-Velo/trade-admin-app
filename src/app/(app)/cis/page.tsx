import { redirect } from "next/navigation";
import { Flash } from "@/components/flash";
import { getCurrentUser } from "@/lib/auth";
import { billingConfigured, featureAllowed, upgradeMessage } from "@/lib/billing/plans";
import { CIS_STATEMENT_NOTE } from "@/lib/cis/calc";
import { loadCisStatement } from "@/lib/cis/load";
import { groupStatement, sumStatement, taxYearChoices } from "@/lib/cis/statement";
import { firstParam, formatDate, formatGBP } from "@/lib/format";
import { isSandboxTrader } from "@/lib/sandbox";

export const metadata = { title: "CIS records" };

export default async function CisPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string; year?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user?.trader) redirect("/onboarding");
  const query = await searchParams;
  const sandbox = isSandboxTrader({ slug: user.trader.slug, email: user.email });
  const allowed = featureAllowed({
    plan: user.trader.plan,
    feature: "cis",
    sandbox,
    billingOn: billingConfigured(),
  });

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="font-serif text-4xl">CIS records</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{CIS_STATEMENT_NOTE}</p>
      </div>
      <Flash error={firstParam(query.error)} notice={firstParam(query.notice)} />
      {allowed ? <Statement year={firstParam(query.year)} traderId={user.trader.id} utr={user.trader.cisUtr} /> : (
        <p className="card text-sm leading-6">
          {upgradeMessage("cis")} <a href="/billing">Open Plans</a>
        </p>
      )}
    </div>
  );
}

async function Statement({ traderId, year, utr }: { traderId: string; year?: string; utr: string }) {
  const now = new Date();
  const statement = await loadCisStatement(traderId, year, now);
  const groups = groupStatement(statement.rows);
  const totals = sumStatement(statement.rows);
  const choices = taxYearChoices(now);
  return (
    <>
      <div className="flex flex-wrap items-center gap-3 text-sm font-semibold">
        {choices.map((startYear) => (
          <a key={startYear} href={`/cis?year=${startYear}`} className={startYear === statement.taxYear.startYear ? "text-pine" : ""}>
            {startYear}/{String((startYear + 1) % 100).padStart(2, "0")}
          </a>
        ))}
        <a href={`/api/cis/csv?year=${statement.taxYear.startYear}`}>Download CSV</a>
        <a href={`/api/cis/pdf?year=${statement.taxYear.startYear}`}>Download PDF</a>
      </div>
      <p className="text-sm text-muted">
        Tax year {statement.taxYear.label}, 6 April to 5 April. Draft invoices are left out.
        {utr ? ` UTR ${utr} is printed on the PDF for your accountant.` : " Add a UTR on Your page if you want it on the PDF."}
      </p>
      <section className="card">
        <h2 className="font-serif text-2xl">Year total</h2>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div className="flex justify-between gap-3"><dt>Labour</dt><dd>{formatGBP(totals.labourPence)}</dd></div>
          <div className="flex justify-between gap-3"><dt>Materials</dt><dd>{formatGBP(totals.materialsPence)}</dd></div>
          <div className="flex justify-between gap-3"><dt>VAT</dt><dd>{formatGBP(totals.vatPence)}</dd></div>
          <div className="flex justify-between gap-3"><dt>Gross</dt><dd>{formatGBP(totals.totalPence)}</dd></div>
          <div className="flex justify-between gap-3"><dt>CIS deduction</dt><dd>{formatGBP(totals.cisDeductionPence)}</dd></div>
          <div className="flex justify-between gap-3 font-semibold"><dt>Payable to you</dt><dd>{formatGBP(totals.amountDuePence)}</dd></div>
        </dl>
        <p className="mt-3 text-sm text-muted">{totals.count} approved invoice{totals.count === 1 ? "" : "s"}.</p>
      </section>
      {groups.length === 0 ? (
        <p className="card text-sm leading-6 text-muted">
          Nothing in this tax year yet. Mark a customer as a contractor, set the labour and materials split on a draft invoice, then approve it.
        </p>
      ) : null}
      {groups.map((group) => (
        <section key={group.key} className="grid gap-3">
          <h2 className="font-serif text-2xl">
            {group.label} <span className="text-base text-muted">deduction {formatGBP(group.totals.cisDeductionPence)}</span>
          </h2>
          {group.rows.map((row) => (
            <a key={row.id} href={`/invoices/${row.id}`} className="card block no-underline">
              <p className="font-semibold text-ink">{row.number} · {row.customerName}</p>
              <p className="mt-1 text-sm text-muted">
                {formatDate(row.issuedAt)} · {row.status.toLowerCase()} · labour {formatGBP(row.labourPence)} · materials {formatGBP(row.materialsPence)} · CIS {row.cisRate}% {formatGBP(row.cisDeductionPence)}
              </p>
              <p className="mt-2 text-sm font-semibold text-ink">Payable to you {formatGBP(row.amountDuePence)}</p>
            </a>
          ))}
        </section>
      ))}
    </>
  );
}
