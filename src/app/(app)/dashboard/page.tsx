import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { formatDate, formatGBP, quoteTotals } from "@/lib/format";
import { checklistProgress } from "@/lib/checklist/catalog";
import { StatusPill } from "@/components/status-pill";
import { redirect } from "next/navigation";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user?.trader) redirect("/onboarding");
  const traderId = user.trader.id;
  const [enquiryCount, grouped, drafts, checklist] = await Promise.all([
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
  ]);
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
