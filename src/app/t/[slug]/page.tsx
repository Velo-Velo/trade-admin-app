import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TraderPublic } from "@/components/trader-public";
import { badgesForWebsite } from "@/lib/checklist/catalog";
import { prisma } from "@/lib/db";
import { firstParam } from "@/lib/format";
import { isDemoSlug } from "@/lib/demo";
import { defaultIntro, postcodeChips, serviceLines, tradeLabel } from "@/lib/trades";

type Params = { slug: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const trader = await prisma.trader.findUnique({ where: { slug } });
  if (!trader) return { title: "Page not found" };
  return {
    title: { absolute: `${trader.businessName} · ${tradeLabel(trader.trade)} in ${trader.area}` },
    description: defaultIntro(trader),
    robots: isDemoSlug(trader.slug) ? { index: false, follow: false } : { index: true, follow: true },
  };
}

export default async function TraderSitePage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const trader = await prisma.trader.findUnique({
    where: { slug },
    include: { checklist: { orderBy: { sortOrder: "asc" } } },
  });
  if (!trader) notFound();
  const photos = await prisma.jobPhoto.findMany({
    where: { showOnWebsite: true, job: { traderId: trader.id } },
    orderBy: { createdAt: "desc" },
    take: 9,
    select: { id: true, kind: true },
  });

  return (
    <TraderPublic
      theme={trader.siteTheme}
      brand={trader.brandColour}
      businessName={trader.businessName}
      tradeLabel={tradeLabel(trader.trade)}
      area={trader.area}
      postcodes={postcodeChips(trader.postcodes)}
      phone={trader.phone}
      intro={defaultIntro(trader)}
      services={serviceLines(trader.services)}
      slug={trader.slug}
      demo={isDemoSlug(trader.slug)}
      error={firstParam(query.error)}
      badges={badgesForWebsite(trader.checklist)}
      photos={photos}
      reviewUrl={trader.googleReviewUrl}
    />
  );
}
