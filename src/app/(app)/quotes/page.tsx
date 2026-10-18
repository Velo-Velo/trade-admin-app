import { redirect } from "next/navigation";
import { StatusPill } from "@/components/status-pill";
import { buttonPrimary } from "@/components/styles";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatDate, formatGBP, quoteTotals } from "@/lib/format";

export const metadata = { title: "Quotes" };

export default async function QuotesPage() {
  const user = await getCurrentUser();
  if (!user?.trader) redirect("/onboarding");
  const quotes = await prisma.quote.findMany({
    where: { traderId: user.trader.id },
    orderBy: { createdAt: "desc" },
    include: { lines: true },
  });

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-serif text-4xl">Quotes</h1>
        <a href="/quotes/new" className={`${buttonPrimary} no-underline`}>
          New draft
        </a>
      </div>
      {quotes.length === 0 ? (
        <p className="card text-sm text-muted">No quotes yet. An enquiry from your page creates a draft automatically.</p>
      ) : (
        <ul className="grid gap-3">
          {quotes.map((quote) => {
            const totals = quoteTotals(
              quote.lines.map((line) => ({
                kind: line.kind,
                quantity: Number(line.quantity),
                unitPricePence: line.unitPricePence,
              })),
              quote.depositPercent,
            );
            return (
              <li key={quote.id}>
                <a href={`/quotes/${quote.id}`} className="card block no-underline">
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
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
