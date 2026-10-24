import { redirect } from "next/navigation";
import { Flash } from "@/components/flash";
import { buttonPrimary } from "@/components/styles";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { firstParam, formatDate } from "@/lib/format";
import { RAMS_DISCLAIMER } from "@/lib/rams/disclaimer";
import { ramsTradeLabel } from "@/lib/rams/library";

export const metadata = { title: "RAMS" };

export default async function RamsListPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string; job?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user?.trader) redirect("/onboarding");
  const query = await searchParams;
  const jobFilter = query.job || "";
  const rams = await prisma.rams.findMany({
    where: {
      traderId: user.trader.id,
      ...(jobFilter ? { jobId: jobFilter } : {}),
    },
    orderBy: { updatedAt: "desc" },
    include: { job: { select: { id: true, title: true } }, customer: { select: { name: true } } },
  });
  const templates = rams.filter((item) => item.isTemplate);
  const documents = rams.filter((item) => !item.isTemplate);

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-4xl">RAMS</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
            A risk assessment and method statement for a job you already have, or from scratch. It starts from a checked library for the trade. You edit it, sign it, and download a PDF.
          </p>
        </div>
        <a href="/rams/new" className={buttonPrimary}>
          New RAMS
        </a>
      </div>
      <Flash error={firstParam(query.error)} notice={firstParam(query.notice)} />
      <aside className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">{RAMS_DISCLAIMER}</aside>
      <p className="text-sm text-muted">
        Insurance, trade cards, training and your health and safety policy live in{" "}
        <a href="/documents">company documents</a>. They are stored so you can reuse them later. Quotestick does not fill in CHAS, SafeContractor, SMAS or Constructionline.
      </p>
      <section className="grid gap-3">
        <h2 className="font-serif text-2xl">On your jobs</h2>
        {documents.length === 0 ? (
          <p className="card text-sm text-muted">No RAMS yet. Start from a job and the library fills in a draft you can edit.</p>
        ) : null}
        {documents.map((item) => (
          <a key={item.id} href={`/rams/${item.id}`} className="card block no-underline">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-semibold text-ink">
                {item.number} · {item.title}
              </p>
              <span className="text-sm font-semibold text-muted">{item.status === "ISSUED" ? "Checked" : "Draft"}</span>
            </div>
            <p className="mt-1 text-sm text-muted">
              {ramsTradeLabel(item.trade)}
              {item.clientName ? ` · ${item.clientName}` : ""}
              {item.job ? ` · ${item.job.title}` : ""}
              {item.customer && !item.job ? ` · ${item.customer.name}` : ""}
              {item.updatedAt ? ` · updated ${formatDate(item.updatedAt)}` : ""}
            </p>
          </a>
        ))}
      </section>
      <section className="grid gap-3">
        <h2 className="font-serif text-2xl">Templates</h2>
        {templates.length === 0 ? (
          <p className="card text-sm text-muted">Save a RAMS as a template when you want to reuse the wording. The copy is not tied to a job.</p>
        ) : (
          templates.map((item) => (
            <a key={item.id} href={`/rams/${item.id}`} className="card block no-underline">
              <p className="font-semibold text-ink">
                {item.number} · {item.title}
              </p>
              <p className="mt-1 text-sm text-muted">{ramsTradeLabel(item.trade)}</p>
            </a>
          ))
        )}
      </section>
    </div>
  );
}
