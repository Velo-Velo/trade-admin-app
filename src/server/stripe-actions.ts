"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { PLAN_CONFIRMING_NOTICE, billingConfigured, featureAllowed, priceIdForPlan, subscriptionStillPaying, upgradeMessage } from "@/lib/billing/plans";
import { ensureExpressAccount, onboardingUrl } from "@/lib/payments/connect";
import { publicStripeReason } from "@/lib/payments/stripe-reason";
import { isSandboxTrader } from "@/lib/sandbox";
import { requestOrigin } from "@/lib/origin";
import { isNextRedirect, redirectWith } from "@/lib/redirects";
import { stripeClient, stripeConfigured } from "@/lib/stripe";

async function currentTrader() {
  const user = await getCurrentUser();
  if (!user?.trader) redirect("/login");
  return { user, trader: user.trader };
}

export async function startStripeConnect() {
  const { user, trader } = await currentTrader();
  if (isSandboxTrader({ slug: trader.slug, email: user.email })) {
    redirectWith("/business", "notice", "This sample account does not connect to Stripe. No payment is taken.");
  }
  if (!stripeConfigured()) {
    redirectWith("/business", "notice", "Stripe is not set up on this server. No payment is taken.");
  }
  if (
    !trader.stripeAccountId &&
    !featureAllowed({
      plan: trader.plan,
      feature: "card_payments",
      sandbox: false,
      billingOn: billingConfigured(),
    })
  ) {
    redirectWith("/business", "error", upgradeMessage("card_payments"));
  }
  const origin = await requestOrigin();
  try {
    const accountId = await ensureExpressAccount({
      traderId: trader.id,
      email: user.email,
      businessName: trader.businessName,
      existingAccountId: trader.stripeAccountId,
    });
    if (!accountId) {
      redirectWith("/business", "notice", "Stripe is not set up on this server. No payment is taken.");
    }
    const url = await onboardingUrl({
      accountId,
      refreshUrl: `${origin}/business?stripe=refresh`,
      returnUrl: `${origin}/business?stripe=return`,
      purpose: trader.stripeChargesEnabled ? "update" : "onboarding",
    });
    if (!url) redirectWith("/business", "error", "Stripe could not open the Connect page. No payment is taken.");
    redirect(url);
  } catch (error) {
    if (isNextRedirect(error)) throw error;
    console.error("[stripe connect]", error);
    redirectWith("/business", "error", publicStripeReason(error));
  }
}

export async function refreshStripeConnect() {
  const { user, trader } = await currentTrader();
  const accountId = trader.stripeAccountId;
  if (isSandboxTrader({ slug: trader.slug, email: user.email }) || !accountId || !stripeConfigured()) {
    redirect("/business");
  }
  const origin = await requestOrigin();
  try {
    const url = await onboardingUrl({
      accountId,
      refreshUrl: `${origin}/business?stripe=refresh`,
      returnUrl: `${origin}/business?stripe=return`,
      purpose: "onboarding",
    });
    if (!url) redirectWith("/business", "error", "Stripe could not open the Connect page. No payment is taken.");
    redirect(url);
  } catch (error) {
    if (isNextRedirect(error)) throw error;
    console.error("[stripe connect]", error);
    redirectWith("/business", "error", publicStripeReason(error));
  }
}

export async function startPlanCheckout(formData: FormData) {
  const { user, trader } = await currentTrader();
  if (isSandboxTrader({ slug: trader.slug, email: user.email })) {
    redirectWith("/billing", "notice", "The sample account does not subscribe. No payment is taken.");
  }
  const plan = String(formData.get("plan") || "");
  if (plan !== "SOLO" && plan !== "PRO") {
    redirectWith("/billing", "error", "Choose Solo or Pro.");
  }
  if (!billingConfigured()) {
    redirectWith("/billing", "notice", "Billing is not configured. No payment was taken.");
  }
  if (trader.stripeCustomerId && subscriptionStillPaying(trader.subscriptionStatus)) {
    await redirectToPortal(trader.stripeCustomerId);
  }
  const price = priceIdForPlan(plan);
  const stripe = stripeClient();
  if (!stripe || !price) {
    redirectWith("/billing", "notice", "Billing is not configured. No payment was taken.");
  }
  const origin = await requestOrigin();
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: trader.stripeCustomerId ?? undefined,
      customer_email: trader.stripeCustomerId ? undefined : user.email,
      client_reference_id: trader.id,
      line_items: [{ price, quantity: 1 }],
      metadata: { traderId: trader.id, plan },
      subscription_data: { metadata: { traderId: trader.id, plan } },
      automatic_tax: { enabled: false },
      success_url: `${origin}/billing?notice=${encodeURIComponent(PLAN_CONFIRMING_NOTICE)}`,
      cancel_url: `${origin}/billing?error=${encodeURIComponent("The plan was not changed. No payment was taken.")}`,
    });
    if (!session.url) redirectWith("/billing", "error", "The billing page could not be opened. No payment was taken.");
    redirect(session.url);
  } catch (error) {
    if (isNextRedirect(error)) throw error;
    console.error("[stripe billing]", error);
    redirectWith("/billing", "error", "The billing page could not be opened. No payment was taken.");
  }
}

export async function openBillingPortal() {
  const { user, trader } = await currentTrader();
  if (isSandboxTrader({ slug: trader.slug, email: user.email })) {
    redirectWith("/billing", "notice", "The sample account does not subscribe. No payment is taken.");
  }
  if (!trader.stripeCustomerId) {
    redirectWith("/billing", "notice", "There is no Stripe customer on this account yet.");
  }
  if (!billingConfigured()) {
    redirectWith("/billing", "notice", "Billing is not configured. No payment was taken.");
  }
  await redirectToPortal(trader.stripeCustomerId);
}

async function redirectToPortal(customerId: string): Promise<never> {
  const stripe = stripeClient();
  if (!stripe) {
    redirectWith("/billing", "notice", "Billing is not configured. No payment was taken.");
  }
  const origin = await requestOrigin();
  try {
    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/billing`,
    });
    redirect(portal.url);
  } catch (error) {
    if (isNextRedirect(error)) throw error;
    console.error("[stripe portal]", error);
    redirectWith("/billing", "error", "The billing page could not be opened.");
  }
}
