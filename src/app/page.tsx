import type { Metadata } from "next";
import { DemoBanner } from "@/components/demo-banner";
import { PhonePreview } from "@/components/phone-preview";
import { SiteFooter } from "@/components/site-footer";
import { buttonPrimary, buttonSecondary } from "@/components/styles";
import { getCurrentUser } from "@/lib/auth";
import { demoModeEnabled } from "@/lib/demo";
import { FAQ, HERO, PLANS, PRICING_NOTE } from "@/lib/marketing";
import { signInDemo } from "@/server/auth-actions";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: { absolute: "Quotestick" },
  description: HERO.lede,
  robots: { index: true, follow: true },
};

export default async function HomePage() {
  const user = await getCurrentUser();
  if (user?.trader) redirect("/dashboard");
  if (user) redirect("/onboarding");
  const demo = demoModeEnabled();

  return (
    <div className="min-h-screen">
      {demo ? <DemoBanner kind="mode" /> : null}
      <header className="border-b border-sand">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
          <p className="font-serif text-2xl tracking-tight">Quotestick</p>
          <nav className="flex items-center gap-1 text-sm font-semibold">
            <a href="#pricing" className="px-3 py-2 no-underline">Prices</a>
            <a href="/login" className="px-3 py-2 no-underline">Sign in</a>
            <a href="/register" className="bg-pine px-3 py-2 text-white no-underline">Create account</a>
          </nav>
        </div>
      </header>
      <main id="main">
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(18rem,0.8fr)] lg:py-20">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-pine">{HERO.kicker}</p>
            <h1 className="mt-3 max-w-xl font-serif text-5xl leading-[0.95] tracking-tight sm:text-7xl">{HERO.title}</h1>
            <p className="mt-5 max-w-lg text-lg leading-8">{HERO.lede}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="/register" className={buttonPrimary}>Create a free account</a>
              {demo ? (
                <form action={signInDemo}>
                  <button className={buttonSecondary} type="submit">Try the demo</button>
                </form>
              ) : (
                <a href="/login" className={buttonSecondary}>Sign in</a>
              )}
            </div>
          </div>
          <PhonePreview />
        </section>

        <section className="border-y border-sand bg-white">
          <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 lg:grid-cols-[16rem_1fr]">
            <h2 className="font-serif text-3xl tracking-tight">From the van to a yes</h2>
            <ol className="grid gap-6">
              <li className="grid gap-2 border-t border-sand pt-4 sm:grid-cols-[8rem_1fr]">
                <p className="font-semibold text-pine">1 · Message</p>
                <p>Describe the job, or forward a WhatsApp message. You get a draft, not a price sent to the customer.</p>
              </li>
              <li className="grid gap-2 border-t border-sand pt-4 sm:grid-cols-[8rem_1fr]">
                <p className="font-semibold text-pine">2 · Approve</p>
                <p>Check labour, materials and the deposit. Tap approve. That is the moment the customer link starts working.</p>
              </li>
              <li className="grid gap-2 border-t border-sand pt-4 sm:grid-cols-[8rem_1fr]">
                <p className="font-semibold text-pine">3 · Get paid</p>
                <p>They accept on their phone. If you take a deposit or send an invoice, the card link and the bank details are on that page.</p>
              </li>
            </ol>
          </div>
        </section>

        <section id="pricing" className="mx-auto max-w-6xl px-5 py-16">
          <div className="max-w-xl">
            <h2 className="font-serif text-4xl tracking-tight">Prices</h2>
            <p className="mt-3 leading-7 text-muted">{PRICING_NOTE}</p>
          </div>
          <div className="mt-8 border border-sand bg-white">
            {PLANS.map((plan, index) => (
              <article key={plan.name} className={`grid gap-4 px-5 py-6 sm:grid-cols-[14rem_1fr] ${index > 0 ? "border-t border-sand" : ""}`}>
                <div>
                  <h3 className="font-serif text-2xl tracking-tight">{plan.name}</h3>
                  <p className="mt-1">
                    <span className="font-serif text-4xl tracking-tight">{plan.price}</span>
                    {plan.period ? <span className="ml-2 text-sm text-muted">{plan.period}</span> : null}
                  </p>
                </div>
                <ul className="grid gap-2 text-sm leading-6">
                  {plan.points.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section className="border-t border-sand">
          <div className="mx-auto grid max-w-6xl gap-8 px-5 py-14 lg:grid-cols-[16rem_1fr]">
            <h2 className="font-serif text-3xl tracking-tight">Questions</h2>
            <div className="divide-y divide-sand border-y border-sand">
              {FAQ.map((item) => (
                <details key={item.q} className="group py-4">
                  <summary className="cursor-pointer font-semibold">{item.q}</summary>
                  <p className="mt-2 max-w-2xl leading-7 text-muted">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
