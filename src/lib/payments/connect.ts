import type Stripe from "stripe";
import { prisma } from "../db";
import { stripeClient } from "../stripe";

export async function ensureExpressAccount(input: { traderId: string; email: string; existingAccountId: string | null }): Promise<string | null> {
  if (input.existingAccountId) return input.existingAccountId;
  const stripe = stripeClient();
  if (!stripe) return null;
  const account = await stripe.accounts.create({
    type: "express",
    country: "GB",
    email: input.email,
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    metadata: { traderId: input.traderId },
  });
  await prisma.trader.update({
    where: { id: input.traderId },
    data: { stripeAccountId: account.id },
  });
  return account.id;
}

export async function onboardingUrl(input: { accountId: string; refreshUrl: string; returnUrl: string }): Promise<string | null> {
  const stripe = stripeClient();
  if (!stripe) return null;
  const link = await stripe.accountLinks.create({
    account: input.accountId,
    refresh_url: input.refreshUrl,
    return_url: input.returnUrl,
    type: "account_onboarding",
  });
  return link.url;
}

export async function syncConnectAccount(traderId: string, accountId: string): Promise<void> {
  const stripe = stripeClient();
  if (!stripe) return;
  const account = await stripe.accounts.retrieve(accountId);
  await prisma.trader.update({
    where: { id: traderId },
    data: {
      stripeChargesEnabled: Boolean(account.charges_enabled),
      stripeDetailsSubmitted: Boolean(account.details_submitted),
      stripePayoutsEnabled: Boolean(account.payouts_enabled),
    },
  });
}

export function subscriptionPriceId(subscription: Stripe.Subscription): string | null {
  const price = subscription.items.data[0]?.price?.id;
  return price ?? null;
}
