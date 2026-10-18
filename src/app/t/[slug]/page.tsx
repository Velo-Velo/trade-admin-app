import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DemoBanner } from "@/components/demo-banner";
import { Flash } from "@/components/flash";
import { buttonPrimary, inputClass, labelClass } from "@/components/styles";
import { foregroundFor } from "@/lib/brand";
import { badgesForWebsite } from "@/lib/checklist/catalog";
import { prisma } from "@/lib/db";
import { firstParam, telHref } from "@/lib/format";
import { isDemoSlug } from "@/lib/demo";
import { defaultIntro, postcodeChips, serviceLines, tradeLabel } from "@/lib/trades";
import { submitEnquiry } from "@/server/enquiry-actions";

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
  const ink = foregroundFor(trader.brandColour);
  const services = serviceLines(trader.services);
  const areas = postcodeChips(trader.postcodes);
  const badges = badgesForWebsite(trader.checklist);

  return (
    <div className="min-h-screen bg-paper">
      {isDemoSlug(trader.slug) ? <DemoBanner kind="sample" /> : null}
      <header style={{ background: trader.brandColour, color: ink }}>
        <div className="mx-auto max-w-3xl px-5 py-10">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] opacity-80">{tradeLabel(trader.trade)}</p>
          <h1 className="mt-2 font-serif text-5xl leading-tight">{trader.logoText}</h1>
          <p className="mt-3 text-lg">{trader.area}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a href={telHref(trader.phone)} className="inline-flex min-h-11 items-center rounded-full bg-white/15 px-4 py-3 font-semibold no-underline" style={{ color: ink }}>
              Call {trader.phone}
            </a>
            <a href="#enquiry" className="inline-flex min-h-11 items-center rounded-full bg-white px-4 py-3 font-semibold text-ink no-underline">
              Request a quote
            </a>
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto grid max-w-3xl gap-8 px-5 py-8">
        <p className="text-lg leading-8">{defaultIntro(trader)}</p>
        {services.length > 0 ? (
          <section>
            <h2 className="font-serif text-3xl">Services</h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {services.map((service) => (
                <li key={service} className="card">{service}</li>
              ))}
            </ul>
          </section>
        ) : null}
        <section>
          <h2 className="font-serif text-3xl">Area covered</h2>
          <p className="mt-2 text-muted">{trader.area}</p>
          {areas.length > 0 ? (
            <ul className="mt-4 flex flex-wrap gap-2">
              {areas.map((area) => (
                <li key={area} className="rounded-full bg-white px-3 py-2 text-sm font-semibold">
                  {area}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
        {badges.length > 0 ? (
          <section>
            <h2 className="font-serif text-3xl">Registrations and insurance</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              These numbers were entered by {trader.businessName}. Quotestick has not checked them. Use the register link where there is one.
            </p>
            <ul className="mt-4 grid gap-3">
              {badges.map((badge) => (
                <li key={`${badge.label}-${badge.reference}`} className="card">
                  <p className="font-semibold">{badge.label}</p>
                  <p className="mt-1 text-sm">{badge.reference}</p>
                  {badge.publicRegister ? (
                    <a href={badge.verifyUrl} className="mt-2 inline-block text-sm font-semibold" target="_blank" rel="noreferrer">
                      Check this on the official register
                    </a>
                  ) : (
                    <p className="mt-2 text-sm text-muted">There is no public register for this. The number was entered by the trader.</p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        <section id="enquiry" className="card">
          <h2 className="font-serif text-3xl">Request a quote</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            This sends {trader.businessName} a draft. They check it before you receive a quote. You will not see a price on this page.
          </p>
          <div className="mt-4">
            <Flash error={firstParam(query.error)} />
          </div>
          <form action={submitEnquiry} className="mt-4 grid gap-4" encType="multipart/form-data">
            <input type="hidden" name="slug" value={trader.slug} />
            <div className="absolute -left-[9999px]" aria-hidden="true">
              <label>
                Company website
                <input name="company_website" tabIndex={-1} autoComplete="off" />
              </label>
            </div>
            <label className={labelClass}>
              Your name
              <input className={inputClass} name="customerName" required autoComplete="name" />
            </label>
            <label className={labelClass}>
              Email or mobile
              <input className={inputClass} name="contact" required autoComplete="email" />
            </label>
            <label className={labelClass}>
              Postcode
              <input className={inputClass} name="postcode" required autoComplete="postal-code" placeholder="SW1A 1AA" />
            </label>
            <label className={labelClass}>
              What needs doing?
              <textarea className={inputClass} name="jobDescription" required rows={5} />
            </label>
            <label className={labelClass}>
              Photos (optional)
              <input className={inputClass} name="photos" type="file" accept="image/jpeg,image/png,image/webp" multiple />
            </label>
            <p className="text-sm text-muted">Up to 4 photos, JPG, PNG or WebP, 2 MB each.</p>
            <button className={buttonPrimary} type="submit">
              Send enquiry
            </button>
          </form>
        </section>
      </main>
      <footer className="border-t border-sand px-5 py-6 text-center text-sm text-muted">
        {trader.businessName}. Quotes are checked by the trader before they are sent. Page built with Quotestick.
      </footer>
    </div>
  );
}
