import type { Metadata } from "next";
import { DemoBanner } from "@/components/demo-banner";
import { buttonPrimary } from "@/components/styles";
import { getCurrentUser } from "@/lib/auth";
import { demoModeEnabled } from "@/lib/demo";
import { signInDemo } from "@/server/auth-actions";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: { absolute: "Quotestick" },
  description:
    "A free one-page website, a start-up checklist, and quotes that stay private until you approve them.",
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
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
        <p className="font-serif text-2xl">Quotestick</p>
        <nav className="flex gap-2">
          <a href="/login" className="rounded-full px-3 py-2 text-sm font-semibold text-ink no-underline">
            Sign in
          </a>
          <a href="/register" className="rounded-full bg-pine px-3 py-2 text-sm font-semibold text-white no-underline">
            Create account
          </a>
        </nav>
      </header>
      <main id="main" className="mx-auto grid max-w-5xl gap-10 px-5 pb-16 pt-6">
        <section className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-pine">For UK trades</p>
          <h1 className="mt-3 font-serif text-4xl leading-tight sm:text-5xl">
            Your page, your checklist, and quotes you approve first.
          </h1>
          <p className="mt-4 text-lg leading-7 text-muted">
            For tradespeople anywhere in the UK. Set up a one-page website, take enquiries, and turn each one into a draft quote.
            The customer cannot open it until you have checked the lines and tapped approve.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            {demo ? (
              <form action={signInDemo}>
                <button className={buttonPrimary} type="submit">
                  Try the demo
                </button>
              </form>
            ) : null}
            <a href="/register" className="inline-flex min-h-11 items-center rounded-xl bg-pine px-4 py-3 font-semibold text-white no-underline">
              Create a free account
            </a>
            <a href="/login" className="inline-flex min-h-11 items-center rounded-xl border border-sand bg-white px-4 py-3 font-semibold no-underline">
              Sign in
            </a>
          </div>
        </section>
        <section className="grid gap-4 sm:grid-cols-3">
          {[
            ["1. Set up", "Business name, trade, area, phone and a text logo. A public page is created at a link you can share."],
            ["2. Take an enquiry", "The customer describes the job and can add photos. You get a draft quote, not an automatic price."],
            ["3. Approve", "Edit labour and materials, then approve. Only then does the customer get a link to accept."],
          ].map(([title, body]) => (
            <article key={title} className="card">
              <h2 className="font-serif text-2xl">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-muted">{body}</p>
            </article>
          ))}
        </section>
        <section className="card max-w-3xl">
          <h2 className="font-serif text-2xl">Plumbing and heating templates to start</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            Tap replacement, radiator swap, boiler service, cistern repair, combi swap, leak repair,
            toilet replacement, powerflush, cylinder replacement and radiator valves. Other trades get a
            blank labour and materials draft. Starter figures are placeholders for you to edit, not a merchant price list.
          </p>
          <p className="mt-3 text-sm leading-6 text-muted">
            Quotestick is a working name. WhatsApp quoting is not in this version. Nothing here is legal or tax advice.
          </p>
        </section>
      </main>
    </div>
  );
}
