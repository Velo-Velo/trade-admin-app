import { redirect } from "next/navigation";
import { Flash } from "@/components/flash";
import { buttonPrimary, buttonSecondary } from "@/components/styles";
import { getCurrentUser } from "@/lib/auth";
import { billingSetup, cancellationNote, planLabel, subscriptionStillPaying, visibleBillingNotice } from "@/lib/billing/plans";
import { firstParam } from "@/lib/format";
import { PLANS, PRICING_NOTE } from "@/lib/marketing";
import { isSandboxTrader } from "@/lib/sandbox";
import { openBillingPortal, startPlanCheckout } from "@/server/stripe-actions";

export const metadata = { title: "Plans" };

const PLAN_KEY = { Free: "FREE", Solo: "SOLO", Pro: "PRO" } as const;

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
  const setup = billingSetup();
  const billing = setup === "ready";
  const current = trader.plan;
  const paying = subscriptionStillPaying(trader.subscriptionStatus);
  const notice = visibleBillingNotice({ notice: firstParam(query.notice), plan: current, status: trader.subscriptionStatus });
  const ending = cancellationNote({
    plan: current,
    cancelAtPeriodEnd: trader.subscriptionCancelAtPeriodEnd,
    cancelAt: trader.subscriptionCancelAt,
  });

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <div>
        <h1 className="font-serif text-4xl tracking-tight">Plans</h1>
        <p className="mt-3 max-w-xl leading-7 text-muted">{PRICING_NOTE}</p>
      </div>
      <Flash error={firstParam(query.error)} notice={notice} />
      {ending ? (
        <div className="grid gap-3 rounded-xl border border-sand bg-white px-4 py-3" role="status">
          <p className="text-sm leading-6">{ending}</p>
          {trader.stripeCustomerId && billing && !sandbox ? (
            <form action={openBillingPortal}>
              <button className={buttonSecondary} type="submit">Undo cancellation in Stripe</button>
            </form>
          ) : null}
        </div>
      ) : null}
      <p className="text-sm">
        This account is on <span className="font-semibold">{planLabel(current)}</span>
        {trader.subscriptionStatus ? ` · Stripe status ${trader.subscriptionStatus}` : ""}.
        {trader.legacyUnlimited && current === "SOLO" ? " The older Trade price is still in use, so the Solo monthly caps do not apply." : ""}
      </p>
      {trader.subscriptionStatus === "past_due" ? (
        <p className="text-sm leading-6">
          The last subscription payment failed. The plan stays on while you update the card in Stripe. Open Manage billing.
        </p>
      ) : null}
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
                      {paying ? `Change to ${plan.name}` : `Choose ${plan.name}`}
                    </button>
                  </form>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
      <p className="text-sm leading-6 text-muted">
        VAT on these prices is not set up. £14 and £24 are the amounts shown. Do not read them as a statement that VAT is included or excluded. Quotestick does not give tax advice.
      </p>
      {sandbox ? (
        <p className="text-sm leading-6 text-muted">The sample account can open every feature, but it does not subscribe and it does not take a payment.</p>
      ) : setup === "ready" ? (
        <p className="text-sm leading-6 text-muted">
          Choosing a paid plan opens Stripe Billing in test mode. Use card 4242 4242 4242 4242. A second subscription is not started if this account already has one: Stripe opens the customer portal so you can change or cancel it.
        </p>
      ) : setup === "live_key" ? (
        <p className="text-sm leading-6">
          Billing is not configured. A live Stripe key is set, and subscriptions stay off until a test key and the Solo and Pro price ids are set. Paid features stay available and no subscription is taken.
        </p>
      ) : (
        <p className="text-sm leading-6">
          Billing is not configured. Upgrade buttons stay hidden until the Stripe test secret and the Solo and Pro price ids are set. Until then, paid features stay available and no subscription is taken.
        </p>
      )}
      {trader.stripeCustomerId && billing && !sandbox ? (
        <form action={openBillingPortal}>
          <button className={buttonSecondary} type="submit">Manage billing in Stripe</button>
        </form>
      ) : null}
    </div>
  );
}
