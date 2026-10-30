import { isCisRate, type CisRate, type CisStatusName } from "./calc";

const STATUSES: CisStatusName[] = ["NOT_USED", "GROSS", "STANDARD", "HIGHER"];

export function parseCisProfile(input: { status: string; utr: string }):
  | { ok: true; cisStatus: CisStatusName; cisUtr: string }
  | { ok: false; error: string } {
  if (!STATUSES.includes(input.status as CisStatusName)) {
    return { ok: false, error: "Choose a CIS status." };
  }
  const utr = input.utr.replace(/\s+/g, "");
  if (utr && !/^\d{10}$/.test(utr)) {
    return {
      ok: false,
      error: "Enter a 10-digit UTR, or leave it blank. It is stored for your records and is not sent to HMRC.",
    };
  }
  return { ok: true, cisStatus: input.status as CisStatusName, cisUtr: utr };
}

export function parseCustomerCis(input: { deducts: boolean; override: string }):
  | { ok: true; deductsCis: boolean; cisRateOverride: CisRate | null }
  | { ok: false; error: string } {
  const raw = input.override.trim();
  if (!raw) return { ok: true, deductsCis: input.deducts, cisRateOverride: null };
  const rate = Number(raw);
  if (!isCisRate(rate)) return { ok: false, error: "Choose gross (0%), 20%, 30%, or leave the rate as your own status." };
  return { ok: true, deductsCis: input.deducts, cisRateOverride: rate };
}
