import { featureAllowed, type PlanName } from "../billing/plans";

export function connectStatusLabel(input: {
  stripeConfigured: boolean;
  sandbox: boolean;
  stripeAccountId: string | null;
  stripeDetailsSubmitted: boolean;
  stripeChargesEnabled: boolean;
}): { label: string; detail: string } {
  if (input.sandbox) {
    return {
      label: "Sample account",
      detail: "This account is sandboxed. It does not open Stripe and it does not take a payment.",
    };
  }
  if (!input.stripeConfigured) {
    return {
      label: "Not connected",
      detail: "Stripe test keys are not set on this server, so Connect cannot start. No payment can be taken.",
    };
  }
  if (!input.stripeAccountId) {
    return {
      label: "Not connected",
      detail: "Connect Stripe so card payments go straight to your account. Quotestick uses Express accounts in the UK.",
    };
  }
  if (!input.stripeDetailsSubmitted) {
    return {
      label: "Finish setup",
      detail: "Stripe still needs a few details before you can take card payments.",
    };
  }
  if (!input.stripeChargesEnabled) {
    return {
      label: "Waiting for Stripe",
      detail: "Your details are in. Stripe has not enabled charges yet.",
    };
  }
  return {
    label: "Connected",
    detail: "Card payments go straight to your Stripe account.",
  };
}

export function cardButtonVisible(input: {
  stripeConfigured: boolean;
  sandbox: boolean;
  stripeAccountId: string | null;
  stripeChargesEnabled: boolean;
  plan: PlanName;
  billingOn: boolean;
}): boolean {
  if (input.sandbox || !input.stripeConfigured) return false;
  if (!input.stripeAccountId || !input.stripeChargesEnabled) return false;
  return featureAllowed({
    plan: input.plan,
    feature: "card_payments",
    billingOn: input.billingOn,
    sandbox: false,
  });
}
