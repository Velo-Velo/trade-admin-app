import type Stripe from "stripe";

export const V2_ACCOUNT_INCLUDE = ["configuration.merchant", "requirements"] as const;

/** Accounts v2 merchant in the UK, with the Express dashboard, for direct card charges. */
export function expressAccountCreateParams(input: {
  email: string;
  traderId: string;
  businessName?: string | null;
}): Stripe.V2.Core.AccountCreateParams {
  const displayName = input.businessName?.trim();
  return {
    contact_email: input.email,
    dashboard: "express",
    ...(displayName ? { display_name: displayName.slice(0, 100) } : {}),
    identity: { country: "gb" },
    configuration: {
      merchant: {
        capabilities: {
          card_payments: { requested: true },
        },
      },
    },
    defaults: {
      currency: "gbp",
      locales: ["en-GB"],
      responsibilities: {
        fees_collector: "stripe",
        losses_collector: "stripe",
      },
    },
    metadata: { traderId: input.traderId },
    include: [...V2_ACCOUNT_INCLUDE, "identity"],
  };
}

export function accountLinkParams(input: {
  accountId: string;
  refreshUrl: string;
  returnUrl: string;
  purpose: "onboarding" | "update";
}): Stripe.V2.Core.AccountLinkCreateParams {
  if (input.purpose === "update") {
    return {
      account: input.accountId,
      use_case: {
        type: "account_update",
        account_update: {
          refresh_url: input.refreshUrl,
          return_url: input.returnUrl,
        },
      },
    };
  }
  return {
    account: input.accountId,
    use_case: {
      type: "account_onboarding",
      account_onboarding: {
        refresh_url: input.refreshUrl,
        return_url: input.returnUrl,
      },
    },
  };
}

type V2StatusAccount = {
  configuration?: {
    merchant?: {
      capabilities?: {
        card_payments?: { status?: string | null } | null;
        stripe_balance?: { payouts?: { status?: string | null } | null } | null;
      } | null;
    } | null;
  } | null;
  requirements?: {
    entries?: Array<{
      awaiting_action_from?: string | null;
      minimum_deadline?: { status?: string | null } | null;
    }> | null;
    summary?: { minimum_deadline?: { status?: string | null } | null } | null;
  } | null;
};

/**
 * v1 charges_enabled, details_submitted and payouts_enabled, read from a v2 account.
 * Card charges are on when merchant card_payments is active. Payouts follow stripe_balance.payouts.
 * Details are submitted once the trader has nothing currently due and Stripe is reviewing or has enabled charges.
 */
export function connectFlagsFromV2Account(account: V2StatusAccount): {
  chargesEnabled: boolean;
  detailsSubmitted: boolean;
  payoutsEnabled: boolean;
} {
  const cardStatus = account.configuration?.merchant?.capabilities?.card_payments?.status ?? "";
  const payoutStatus = account.configuration?.merchant?.capabilities?.stripe_balance?.payouts?.status ?? "";
  const chargesEnabled = cardStatus === "active";
  const payoutsEnabled = payoutStatus === "active";
  const requirementsKnown = account.requirements != null;
  const entries = account.requirements?.entries ?? [];
  const userActionDue = entries.some((entry) => {
    const waiting = entry.awaiting_action_from ?? "user";
    const status = entry.minimum_deadline?.status;
    return waiting === "user" && (status === "currently_due" || status === "past_due");
  });
  const summary = account.requirements?.summary?.minimum_deadline?.status;
  const summaryDue = summary === "currently_due" || summary === "past_due";
  const waitingOnStripe = cardStatus === "pending" || cardStatus === "restricted";
  const detailsSubmitted = chargesEnabled || (requirementsKnown && !userActionDue && !summaryDue && waitingOnStripe);
  return { chargesEnabled, detailsSubmitted, payoutsEnabled };
}

export function isThinEventPayload(body: string): boolean {
  try {
    const parsed = JSON.parse(body) as { object?: unknown };
    return parsed.object === "v2.core.event";
  } catch {
    return false;
  }
}

export function stripeV2AccountWebhookSecret(env: NodeJS.ProcessEnv): string | null {
  const value = env.STRIPE_V2_ACCOUNT_WEBHOOK_SECRET?.trim() ?? "";
  return value.length > 0 ? value : null;
}

/** Thin events for v2 accounts. related_object.id is the connected account. */
export function accountIdFromThinNotification(notification: {
  type: string;
  related_object?: { id?: string | null; type?: string; url?: string } | null;
}): string | null {
  if (!notification.type.startsWith("v2.core.account")) return null;
  const related = notification.related_object;
  const id = related && "id" in related ? related.id : null;
  return typeof id === "string" && id.startsWith("acct_") ? id : null;
}
