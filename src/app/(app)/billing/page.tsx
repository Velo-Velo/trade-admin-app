import { redirect } from "next/navigation";
import { Flash } from "@/components/flash";
import { buttonPrimary, buttonSecondary } from "@/components/styles";
import { getCurrentUser } from "@/lib/auth";
import { billingConfigured } from "@/lib/billing/plans";
import { firstParam } from "@/lib/format";
import { PLANS, PRICING_NOTE } from "@/lib/marketing";
import { isSandboxTrader } from "@/lib/sandbox";
import { openBillingPortal, startPlanCheckout } from "@/server/stripe-actions";

export const metadata = { title: "Plans" };

const PLAN_KEY = { Free: "FREE", Trade: "TRADE", "Splitstick bundle": "SPLITSTICK" } as const;

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user?.trader) redirect("/onboarding");
  const query = await searchParams;
  const trader = user.trader;
  const sandbox = isSandboxTrader({ slug: trader.slug, email: user.email });
  const billing = billingConfigured();
  const current = trader.plan;

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <div>
        <h1 className="font-serif text-4xl tracking-tight">Plans</h1>
        <p className="mt-3 max-w-xl leading-7 text-muted">{PRICING_NOTE}</p>
      </div>
      <Flash error={firstParam(query.error)} notice={firstParam(query.notice)} />
      <p className="text-sm">
        This account is on <span className="font-semibold">{current === "SPLITSTICK" ? "Splitstick bundle" : current === "TRADE" ? "Trade" : "Free"}</span>
        {trader.subscriptionStatus ? ` · Stripe status ${trader.subscriptionStatus}` : ""}.
      </p>
      <div id="plans" className="border border-sand bg-white">
        {PLANS.map((plan, index) => {
          const key = PLAN_KEY[plan.name];
          const active = key === current;
          return (
            <article key={plan.name} className={`grid gap-4 px-5 py-6 sm:grid-cols-[14rem_1fr] ${index > 0 ? "border-t border-sand" : ""}`}>
              <div>
                <h2 className="font-serif text-2xl tracking-tight">{plan.name}</h2>
                <p className="mt-1">
                  <span className="font-serif text-4xl tracking-tight">{plan.price}</span>
                  {plan.period ? <span className="ml-2 text-sm text-muted">{plan.period}</span> : null}
                </p>
                {active ? <p className="mt-2 text-sm font-semibold text-pine">Current plan</p> : null}
              </div>
              <div>
                <ul className="grid gap-2 text-sm leading-6">
                  {plan.points.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
                {key !== "FREE" && !active && billing && !sandbox ? (
                  <form action={startPlanCheckout} className="mt-4">
                    <input type="hidden" name="plan" value={key} />
                    <button className={buttonPrimary} type="submit">
                      Choose {plan.name}
                    </button>
                  </form>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
      {sandbox ? (
        <p className="text-sm leading-6 text-muted">The sample account can open every feature, but it does not subscribe and it does not take a payment.</p>
      ) : billing ? (
        <p className="text-sm leading-6 text-muted">Choosing a paid plan opens Stripe Billing. You can change or cancel it from the Stripe customer portal.</p>
      ) : (
        <p className="text-sm leading-6">Upgrade buttons stay hidden until the Stripe secret key and both price IDs are set. Until then, paid features stay available and no subscription is taken.</p>
      )}
      {trader.stripeCustomerId && billing && !sandbox ? (
        <form action={openBillingPortal}>
          <button className={buttonSecondary} type="submit">Manage billing in Stripe</button>
        </form>
      ) : null}
    </div>
  );
}
