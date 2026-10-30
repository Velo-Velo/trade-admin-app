export type PlanName = "FREE" | "TRADE" | "SPLITSTICK";

export type PaidFeature =
  | "invoices"
  | "whatsapp"
  | "photos"
  | "chasers"
  | "card_payments"
  | "manual_jobs"
  | "splitstick";

export type BillingEnv = {
  STRIPE_SECRET_KEY?: string;
  STRIPE_PRICE_TRADE?: string;
  STRIPE_PRICE_SPLITSTICK?: string;
};

const TRADE_FEATURES = new Set<PaidFeature>([
  "invoices",
  // Draft quotes, invoices and RAMS over WhatsApp. Receipt photos are not listed: they stay on every plan.
  "whatsapp",
  "photos",
  "chasers",
  "card_payments",
  "manual_jobs",
]);

function readBillingEnv(env?: BillingEnv): BillingEnv {
  if (env) return env;
  return {
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_PRICE_TRADE: process.env.STRIPE_PRICE_TRADE,
    STRIPE_PRICE_SPLITSTICK: process.env.STRIPE_PRICE_SPLITSTICK,
  };
}

export function billingConfigured(env?: BillingEnv): boolean {
  const resolved = readBillingEnv(env);
  return Boolean(resolved.STRIPE_SECRET_KEY && resolved.STRIPE_PRICE_TRADE && resolved.STRIPE_PRICE_SPLITSTICK);
}

export function planForPriceId(priceId: string | null | undefined, env?: BillingEnv): "TRADE" | "SPLITSTICK" | null {
  const resolved = readBillingEnv(env);
  if (!priceId) return null;
  if (resolved.STRIPE_PRICE_TRADE && priceId === resolved.STRIPE_PRICE_TRADE) return "TRADE";
  if (resolved.STRIPE_PRICE_SPLITSTICK && priceId === resolved.STRIPE_PRICE_SPLITSTICK) return "SPLITSTICK";
  return null;
}

export function priceIdForPlan(plan: "TRADE" | "SPLITSTICK", env?: BillingEnv): string | null {
  const resolved = readBillingEnv(env);
  const id = plan === "TRADE" ? resolved.STRIPE_PRICE_TRADE : resolved.STRIPE_PRICE_SPLITSTICK;
  return id || null;
}

/** Paid product features stay open until Stripe Billing is fully configured. The sample account is never gated. */
export function featureAllowed(input: {
  plan: PlanName;
  feature: PaidFeature;
  sandbox?: boolean;
  billingOn?: boolean;
  env?: BillingEnv;
}): boolean {
  if (input.sandbox) return true;
  const billingOn = input.billingOn ?? billingConfigured(input.env);
  if (!billingOn) return true;
  if (input.plan === "SPLITSTICK") return true;
  if (input.plan === "TRADE") return TRADE_FEATURES.has(input.feature);
  return false;
}

const KEEPS_PLAN = new Set(["active", "trialing", "past_due"]);

export function planAfterSubscription(input: {
  status: string;
  priceId: string | null;
  env?: BillingEnv;
}): { plan: PlanName; status: string; priceId: string } {
  const mapped = KEEPS_PLAN.has(input.status) ? planForPriceId(input.priceId, input.env) : null;
  return {
    plan: mapped ?? "FREE",
    status: input.status,
    priceId: input.priceId ?? "",
  };
}

export function sendBlockReason(input: { emailVerifiedAt: Date | null; sandbox: boolean }): string | null {
  if (input.sandbox || input.emailVerifiedAt) return null;
  return "Confirm your email before anything is sent to a customer. Open Account and send the confirmation link. Nothing was sent.";
}

export function upgradeMessage(feature: PaidFeature): string {
  if (feature === "splitstick") {
    return "Receipt prices are on the Splitstick bundle. Open Plans. Nothing was changed.";
  }
  return "That is on the Trade plan. Open Plans to switch it on. Nothing was sent.";
}
