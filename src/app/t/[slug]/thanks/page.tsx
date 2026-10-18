import { notFound } from "next/navigation";
import { DemoBanner } from "@/components/demo-banner";
import { DocumentMast } from "@/components/document-mast";
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
      <DocumentMast theme={trader.siteTheme} brand={trader.brandColour} name={trader.businessName} kicker="Enquiry" />
      <main id="main" className="mx-auto max-w-xl px-5 py-12">
        <h1 className="font-serif text-4xl tracking-tight">That has been sent</h1>
        <p className="mt-4 leading-7">
          {trader.businessName} has your enquiry and will send a quote after they have checked it. Nothing has been confirmed, and no payment has been taken.
        </p>
        <a href={`/t/${trader.slug}`} className="mt-6 inline-flex font-semibold">
          Back to the page
        </a>
      </main>
    </div>
  );
}
