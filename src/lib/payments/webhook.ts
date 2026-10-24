import type Stripe from "stripe";

type WebhookVerifier = {
  webhooks: {
    constructEvent: (body: string, signature: string, secret: string) => Stripe.Event;
  };
};

export function stripeWebhookSecrets(env: NodeJS.ProcessEnv): string[] {
  return [env.STRIPE_WEBHOOK_SECRET, env.STRIPE_CONNECT_WEBHOOK_SECRET]
    .map((value) => value?.trim() ?? "")
    .filter((value) => value.length > 0);
}

/** Tries each destination secret. Both destinations post to the same URL. */
export function constructStripeEvent(
  stripe: WebhookVerifier,
  body: string,
  signature: string,
  secrets: string[],
): Stripe.Event {
  let lastError: unknown;
  for (const secret of secrets) {
    try {
      return stripe.webhooks.constructEvent(body, signature, secret);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Invalid signature");
}

export type StripeWebhookKind =
  | "connected_payment"
  | "platform_payment"
  | "subscription_checkout"
  | "subscription"
  | "ignore";

/**
 * Connected-account events set event.account. Deposit and invoice payments
 * are matched later by checkout metadata or the payment link.
 * Subscriptions are platform events and have no account id.
 */
export function stripeEventKind(event: Stripe.Event): StripeWebhookKind {
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    if (event.account) {
      return session.payment_status === "paid" ? "connected_payment" : "ignore";
    }
    if (session.mode === "subscription") return "subscription_checkout";
    return session.payment_status === "paid" ? "platform_payment" : "ignore";
  }
  if (
    !event.account &&
    (event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted")
  ) {
    return "subscription";
  }
  return "ignore";
}
