import { billingConfigured, featureAllowed, sendBlockReason, upgradeMessage, type PaidFeature, type PlanName } from "@/lib/billing/plans";
import { isSandboxTrader } from "@/lib/sandbox";
import { redirectWith } from "@/lib/redirects";

type GateUser = {
  email: string;
  emailVerifiedAt: Date | null;
  trader: { slug: string; plan: PlanName } | null;
};

export function traderSandbox(user: { email: string; trader: { slug: string } | null }): boolean {
  return isSandboxTrader({ slug: user.trader?.slug, email: user.email });
}

export function enforceFeature(user: GateUser, feature: PaidFeature, back: string): void {
  if (!user.trader) redirectWith("/login", "error", "Sign in to continue.");
  if (!featureAllowed({ plan: user.trader.plan, feature, sandbox: traderSandbox(user), billingOn: billingConfigured() })) {
    redirectWith(back, "error", upgradeMessage(feature));
  }
}

export function enforceVerified(user: GateUser, back: string): void {
  const reason = sendBlockReason({ emailVerifiedAt: user.emailVerifiedAt, sandbox: traderSandbox(user) });
  if (reason) redirectWith(back, "error", reason);
}
