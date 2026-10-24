const SECRET = /\b(?:sk|rk|pk)_(?:live|test)_[A-Za-z0-9]+|\bwhsec_[A-Za-z0-9]+/g;

function messageOf(error: unknown): string {
  if (error && typeof error === "object" && "message" in error && typeof (error as { message?: unknown }).message === "string") {
    return (error as { message: string }).message;
  }
  return "";
}

/** A short Stripe message safe to show a signed-in trader. Secrets are removed. */
export function publicStripeReason(error: unknown): string {
  const cleaned = messageOf(error).replace(SECRET, "[removed]").replace(/\s+/g, " ").trim();
  const reason = cleaned.slice(0, 160).trim();
  if (!reason) return "Stripe could not open the Connect page. No payment was taken.";
  return `Stripe could not open the Connect page. ${reason} No payment was taken.`;
}
