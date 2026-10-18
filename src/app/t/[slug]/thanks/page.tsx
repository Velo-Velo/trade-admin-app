import { notFound } from "next/navigation";
import { DemoBanner } from "@/components/demo-banner";
import { isDemoSlug } from "@/lib/demo";
import { prisma } from "@/lib/db";

export const metadata = { title: "Enquiry sent", robots: { index: false, follow: false } };

export default async function ThanksPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const trader = await prisma.trader.findUnique({ where: { slug } });
  if (!trader) notFound();

  return (
    <div className="min-h-screen">
      {isDemoSlug(trader.slug) ? <DemoBanner kind="sample" /> : null}
    <main id="main" className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-5">
      <p className="text-sm font-semibold uppercase tracking-wide text-pine">{trader.businessName}</p>
      <h1 className="mt-2 font-serif text-4xl">Thanks, that has been sent</h1>
      <p className="mt-3 leading-7 text-muted">
        {trader.businessName} has your enquiry and will send a quote after they have checked it. Nothing has been confirmed yet, and no payment has been taken.
      </p>
      <a href={`/t/${trader.slug}`} className="mt-6 font-semibold text-pine">
        Back to the page
      </a>
    </main>
    </div>
  );
}
