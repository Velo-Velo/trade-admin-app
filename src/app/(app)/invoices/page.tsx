import { redirect } from "next/navigation";
import { Flash } from "@/components/flash";
import { StatusPill } from "@/components/status-pill";
import { UpgradePrompt } from "@/components/upgrade-prompt";
import { buttonPrimary, inputClass, labelClass } from "@/components/styles";
import { getCurrentUser } from "@/lib/auth";
import { londonMonthStart, traderAccess } from "@/lib/billing/plans";
import { prisma } from "@/lib/db";
import { firstParam, formatDate, formatGBP } from "@/lib/format";
import { isSandboxTrader } from "@/lib/sandbox";
import { createInvoiceFromText } from "@/server/invoice-actions";

export const metadata = { title: "Invoices" };

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user?.trader) redirect("/onboarding");
  const query = await searchParams;
  const access = traderAccess({
    plan: user.trader.plan,
    sandbox: isSandboxTrader({ slug: user.trader.slug, email: user.email }),
    legacyUnlimited: user.trader.legacyUnlimited,
  });
  const invoicesThisMonth = access.invoiceCap == null
    ? 0
    : await prisma.invoice.count({
        where: { traderId: user.trader.id, createdAt: { gte: londonMonthStart(new Date()) } },
      });
  const atInvoiceCap = access.invoiceCap != null && invoicesThisMonth >= access.invoiceCap;
  const invoices = await prisma.invoice.findMany({
    where: { traderId: user.trader.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="font-serif text-4xl">Invoices</h1>
        <p className="mt-2 text-sm text-muted">A draft stays with you until you approve it.</p>
      </div>
      <Flash error={firstParam(query.error)} notice={firstParam(query.notice)} />
      {!access.invoices ? <UpgradePrompt feature="invoices" /> : atInvoiceCap ? <UpgradePrompt feature="invoice_volume" /> : null}
      {access.invoices && !atInvoiceCap ? <form action={createInvoiceFromText} className="card grid gap-3">
        <h2 className="font-serif text-2xl">Quick invoice</h2>
        <label className={labelClass}>
          Describe it in one line
          <textarea className={inputClass} name="text" rows={3} required placeholder="Invoice Mrs Jones, replaced tap, £80" />
        </label>
        <button className={buttonPrimary} type="submit">Create draft invoice</button>
      </form> : null}
      {invoices.length === 0 ? (
        <p className="card text-sm text-muted">No invoices yet.</p>
      ) : (
        <ul className="grid gap-3">
          {invoices.map((invoice) => (
            <li key={invoice.id}>
              <a href={`/invoices/${invoice.id}`} className="card block no-underline">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-ink">{invoice.customerName}</p>
                    <p className="text-sm text-muted">{invoice.number} · Due {formatDate(invoice.dueAt)}</p>
                  </div>
                  <StatusPill status={invoice.status} />
                </div>
                <p className="mt-2 text-sm text-muted">{invoice.description}</p>
                <p className="mt-3 font-semibold">{formatGBP(invoice.totalPence)}</p>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
