import type Stripe from "stripe";
import { prisma } from "../db";
import { stripeClient } from "../stripe";
import {
  accountLinkParams,
  connectFlagsFromV2Account,
  expressAccountCreateParams,
  V2_ACCOUNT_INCLUDE,
} from "./connect-account";

export async function ensureExpressAccount(input: {
  traderId: string;
  email: string;
  businessName?: string | null;
  existingAccountId: string | null;
}): Promise<string | null> {
  if (input.existingAccountId) return input.existingAccountId;
  const stripe = stripeClient();
  if (!stripe) return null;
  const account = await stripe.v2.core.accounts.create(
    expressAccountCreateParams({
      email: input.email,
      traderId: input.traderId,
      businessName: input.businessName,
    }),
  );
  await prisma.trader.update({
    where: { id: input.traderId },
    data: { stripeAccountId: account.id },
  });
  return account.id;
}

export async function onboardingUrl(input: {
  accountId: string;
  refreshUrl: string;
  returnUrl: string;
  purpose?: "onboarding" | "update";
}): Promise<string | null> {
  const stripe = stripeClient();
  if (!stripe) return null;
  const link = await stripe.v2.core.accountLinks.create(
    accountLinkParams({
      accountId: input.accountId,
      refreshUrl: input.refreshUrl,
      returnUrl: input.returnUrl,
      purpose: input.purpose ?? "onboarding",
    }),
  );
  return link.url;
}

export async function syncConnectAccount(traderId: string, accountId: string): Promise<void> {
  const stripe = stripeClient();
  if (!stripe) return;
  const account = await stripe.v2.core.accounts.retrieve(accountId, { include: [...V2_ACCOUNT_INCLUDE] });
  const flags = connectFlagsFromV2Account(account);
  await prisma.trader.update({
    where: { id: traderId },
    data: {
      stripeChargesEnabled: flags.chargesEnabled,
      stripeDetailsSubmitted: flags.detailsSubmitted,
      stripePayoutsEnabled: flags.payoutsEnabled,
    },
  });
}

export async function syncConnectAccountByStripeId(accountId: string): Promise<void> {
  const trader = await prisma.trader.findFirst({ where: { stripeAccountId: accountId }, select: { id: true } });
  if (!trader) return;
  await syncConnectAccount(trader.id, accountId);
}

export function subscriptionPriceId(subscription: Stripe.Subscription): string | null {
  const price = subscription.items.data[0]?.price?.id;
  return price ?? null;
}
