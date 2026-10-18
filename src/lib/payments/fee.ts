/** Basis points kept by the platform on a connected-account charge. Unset or invalid means 0. */
export function platformFeePence(amountPence: number, bpsRaw: string | undefined = process.env.STRIPE_PLATFORM_FEE_BPS): number {
  if (!Number.isInteger(amountPence) || amountPence <= 0) return 0;
  if (bpsRaw == null || bpsRaw.trim() === "") return 0;
  const bps = Number(bpsRaw);
  if (!Number.isInteger(bps) || bps <= 0) return 0;
  return Math.floor((amountPence * bps) / 10000);
}

export function platformFeeBps(bpsRaw: string | undefined = process.env.STRIPE_PLATFORM_FEE_BPS): number {
  if (bpsRaw == null || bpsRaw.trim() === "") return 0;
  const bps = Number(bpsRaw);
  if (!Number.isInteger(bps) || bps <= 0) return 0;
  return bps;
}

export function platformFeeSentence(bps: number): string {
  if (bps <= 0) {
    return "Card payments go straight to your Stripe account. Quotestick does not keep a fee on them.";
  }
  const percent = (bps / 100).toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
  return `Card payments go to your Stripe account. Quotestick keeps ${percent}% of each one.`;
}
