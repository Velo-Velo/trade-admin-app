export type PlanName = "FREE" | "SOLO" | "PRO";

export type PaidFeature =
  | "invoices"
  | "whatsapp"
  | "photos"
  | "chasers"
  | "card_payments"
  | "manual_jobs"
  | "splitstick"
  | "diary"
  | "cis";

export type VolumeFeature = "invoice_volume" | "photo_volume";

export type UpgradeFeature = PaidFeature | VolumeFeature;

/** A normal month for one person. Pro removes the cap. */
export const SOLO_INVOICE_MONTHLY_LIMIT = 40;
/** Before and after shots stored on the account. Pro removes the cap. */
export const SOLO_PHOTO_LIMIT = 150;

export const PLAN_PRICE_PENCE = { SOLO: 1400, PRO: 2400 } as const;

export type BillingEnv = {
  STRIPE_SECRET_KEY?: string;
  STRIPE_PRICE_SOLO?: string;
  STRIPE_PRICE_PRO?: string;
  /** Previous Trade price. Maps an existing subscription to Solo. Not offered to new customers. */
  STRIPE_PRICE_TRADE?: string;
  /** Previous Splitstick bundle price. Maps an existing subscription to Pro. */
  STRIPE_PRICE_SPLITSTICK?: string;
};

const SOLO_FEATURES = new Set<PaidFeature>([
  "invoices",
  // Draft quotes, invoices and RAMS over WhatsApp. Receipt photos are not listed: they stay on every plan.
  "whatsapp",
  "photos",
  "chasers",
  "card_payments",
  "manual_jobs",
  "diary",
]);
// CIS deductions and the accountant statement are on Pro only.
// featureAllowed returns true for every feature on that plan. Receipt photos stay ungated.

const KEEPS_PLAN = new Set(["active", "trialing", "past_due"]);

function clean(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function readBillingEnv(env?: BillingEnv): BillingEnv {
  if (env) return env;
  return {
    STRIPE_SECRET_KEY: clean(process.env.STRIPE_SECRET_KEY),
    STRIPE_PRICE_SOLO: clean(process.env.STRIPE_PRICE_SOLO),
    STRIPE_PRICE_PRO: clean(process.env.STRIPE_PRICE_PRO),
    STRIPE_PRICE_TRADE: clean(process.env.STRIPE_PRICE_TRADE),
    STRIPE_PRICE_SPLITSTICK: clean(process.env.STRIPE_PRICE_SPLITSTICK),
  };
}

export function stripeSecretIsTest(secret: string | undefined): boolean {
  return Boolean(secret && secret.startsWith("sk_test_"));
}

/**
 * Subscriptions turn on only with a Stripe test secret and both current price ids.
 * A live key, or a missing price id, leaves paid features open and hides checkout.
 */
export function billingConfigured(env?: BillingEnv): boolean {
  const resolved = readBillingEnv(env);
  return stripeSecretIsTest(resolved.STRIPE_SECRET_KEY) && Boolean(resolved.STRIPE_PRICE_SOLO && resolved.STRIPE_PRICE_PRO);
}

export type BillingSetup = "ready" | "missing" | "live_key";

export function billingSetup(env?: BillingEnv): BillingSetup {
  const resolved = readBillingEnv(env);
  const secret = resolved.STRIPE_SECRET_KEY ?? "";
  if (secret && !stripeSecretIsTest(secret)) return "live_key";
  if (billingConfigured(resolved)) return "ready";
  return "missing";
}

export function planForPriceId(priceId: string | null | undefined, env?: BillingEnv): "SOLO" | "PRO" | null {
  const resolved = readBillingEnv(env);
  if (!priceId) return null;
  if (resolved.STRIPE_PRICE_SOLO && priceId === resolved.STRIPE_PRICE_SOLO) return "SOLO";
  if (resolved.STRIPE_PRICE_TRADE && priceId === resolved.STRIPE_PRICE_TRADE) return "SOLO";
  if (resolved.STRIPE_PRICE_PRO && priceId === resolved.STRIPE_PRICE_PRO) return "PRO";
  if (resolved.STRIPE_PRICE_SPLITSTICK && priceId === resolved.STRIPE_PRICE_SPLITSTICK) return "PRO";
  return null;
}

export function priceIdForPlan(plan: "SOLO" | "PRO", env?: BillingEnv): string | null {
  const resolved = readBillingEnv(env);
  const id = plan === "SOLO" ? resolved.STRIPE_PRICE_SOLO : resolved.STRIPE_PRICE_PRO;
  return id || null;
}

export function isLegacyTradePrice(priceId: string | null | undefined, env?: BillingEnv): boolean {
  const resolved = readBillingEnv(env);
  return Boolean(priceId && resolved.STRIPE_PRICE_TRADE && priceId === resolved.STRIPE_PRICE_TRADE);
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
  if (input.plan === "PRO") return true;
  if (input.plan === "SOLO") return SOLO_FEATURES.has(input.feature);
  return false;
}

export function planAfterSubscription(input: {
  status: string;
  priceId: string | null;
  env?: BillingEnv;
}): { plan: PlanName; status: string; priceId: string; legacyUnlimited: boolean } {
  const mapped = KEEPS_PLAN.has(input.status) ? planForPriceId(input.priceId, input.env) : null;
  const plan = mapped ?? "FREE";
  return {
    plan,
    status: input.status,
    priceId: input.priceId ?? "",
    legacyUnlimited: plan === "SOLO" && isLegacyTradePrice(input.priceId, input.env),
  };
}

export function subscriptionStillPaying(status: string): boolean {
  return KEEPS_PLAN.has(status);
}

export function planLabel(plan: PlanName): string {
  if (plan === "SOLO") return "Solo";
  if (plan === "PRO") return "Pro";
  return "Free";
}

/** Null means no cap: Free is not counting, Pro is unlimited, or billing is off. */
export function volumeCap(input: {
  plan: PlanName;
  kind: "invoices" | "photos";
  sandbox?: boolean;
  billingOn: boolean;
  legacyUnlimited?: boolean;
}): number | null {
  if (input.sandbox || !input.billingOn) return null;
  if (input.plan !== "SOLO" || input.legacyUnlimited) return null;
  return input.kind === "invoices" ? SOLO_INVOICE_MONTHLY_LIMIT : SOLO_PHOTO_LIMIT;
}

export function volumeAllows(cap: number | null, used: number, adding: number): boolean {
  if (cap == null) return true;
  return used + adding <= cap;
}

export function traderAccess(input: {
  plan: PlanName;
  sandbox: boolean;
  legacyUnlimited?: boolean;
  billingOn?: boolean;
  env?: BillingEnv;
}) {
  const billingOn = input.billingOn ?? billingConfigured(input.env);
  const allow = (feature: PaidFeature) =>
    featureAllowed({ plan: input.plan, feature, sandbox: input.sandbox, billingOn, env: input.env });
  return {
    billingOn,
    plan: input.plan,
    invoices: allow("invoices"),
    whatsappDrafts: allow("whatsapp"),
    photos: allow("photos"),
    chasers: allow("chasers"),
    cardPayments: allow("card_payments"),
    manualJobs: allow("manual_jobs"),
    splitstick: allow("splitstick"),
    diary: allow("diary"),
    cis: allow("cis"),
    invoiceCap: volumeCap({
      plan: input.plan,
      kind: "invoices",
      sandbox: input.sandbox,
      billingOn,
      legacyUnlimited: input.legacyUnlimited,
    }),
    photoCap: volumeCap({
      plan: input.plan,
      kind: "photos",
      sandbox: input.sandbox,
      billingOn,
      legacyUnlimited: input.legacyUnlimited,
    }),
  };
}

function londonParts(date: Date): { year: number; month: number; day: number; hour: string; minute: string } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  let hour = get("hour");
  if (hour === "24") hour = "00";
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour,
    minute: get("minute"),
  };
}

/** Start of the calendar month in Europe/London, as a UTC instant. */
export function londonMonthStart(now: Date): Date {
  const current = londonParts(now);
  const utcFirst = Date.UTC(current.year, current.month - 1, 1, 0, 0, 0);
  for (const hours of [0, -1, 1]) {
    const candidate = new Date(utcFirst + hours * 60 * 60 * 1000);
    const parts = londonParts(candidate);
    if (
      parts.year === current.year &&
      parts.month === current.month &&
      parts.day === 1 &&
      parts.hour === "00" &&
      parts.minute === "00"
    ) {
      return candidate;
    }
  }
  return new Date(utcFirst);
}

export function sendBlockReason(input: { emailVerifiedAt: Date | null; sandbox: boolean }): string | null {
  if (input.sandbox || input.emailVerifiedAt) return null;
  return "Confirm your email before anything is sent to a customer. Open Account and send the confirmation link. Nothing was sent.";
}

export function upgradeTitle(feature: UpgradeFeature): string {
  switch (feature) {
    case "invoices":
      return "Invoices are on Solo";
    case "whatsapp":
      return "WhatsApp drafts are on Solo";
    case "photos":
      return "Job photos are on Solo";
    case "chasers":
      return "Follow-ups are on Solo";
    case "card_payments":
      return "Card payments are on Solo";
    case "manual_jobs":
      return "Adding a job is on Solo";
    case "splitstick":
      return "Splitstick prices are on Pro";
    case "diary":
      return "The diary is on Solo";
    case "cis":
      return "CIS records are on Pro";
    case "invoice_volume":
      return "That is the Solo invoice limit";
    case "photo_volume":
      return "That is the Solo photo limit";
  }
}

export function upgradeMessage(feature: UpgradeFeature): string {
  switch (feature) {
    case "invoices":
      return "Invoices are on Solo. Open Plans. Nothing was sent.";
    case "whatsapp":
      return "Draft quotes, invoices and RAMS on WhatsApp are on Solo. Receipt photos stay on every plan. Open Plans. Nothing was sent.";
    case "photos":
      return "Job photos are on Solo. Open Plans. Nothing was saved.";
    case "chasers":
      return "Quote follow-ups and service reminders are on Solo. Open Plans. Nothing was sent.";
    case "card_payments":
      return "Card payments are on Solo. Open Plans. No payment was taken.";
    case "manual_jobs":
      return "Adding a job yourself is on Solo. An accepted quote still books a job on Free. Open Plans. Nothing was booked.";
    case "splitstick":
      return "Last-paid prices from Splitstick are on Pro. Open Plans. Nothing was changed.";
    case "diary":
      return "The diary is on Solo. Open Plans. Nothing was changed.";
    case "cis":
      return "CIS records are on Pro. Open Plans. Nothing was filed.";
    case "invoice_volume":
      return `Solo includes ${SOLO_INVOICE_MONTHLY_LIMIT} invoices a month. Open Plans to move to Pro. Nothing was created.`;
    case "photo_volume":
      return `Solo includes ${SOLO_PHOTO_LIMIT} job photos. Open Plans to move to Pro. Nothing was saved.`;
  }
}
