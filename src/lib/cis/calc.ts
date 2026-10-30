import { formatGBP, poundsToPence } from "../format";

export const CIS_RATES = [0, 20, 30] as const;
export type CisRate = (typeof CIS_RATES)[number];
export type CisStatusName = "NOT_USED" | "GROSS" | "STANDARD" | "HIGHER";

export const CIS_INVOICE_NOTE =
  "The CIS deduction is a record of what you entered. It is worked out on the labour only, not on materials or VAT. Quotestick does not send it to HMRC and does not give tax advice.";

export const CIS_STATEMENT_NOTE =
  "This statement is for your records and your accountant. It is not a CIS return, it has not been sent to HMRC, and it is not tax advice. Check the rate and the labour split before you rely on it.";

export function isCisRate(value: number | null | undefined): value is CisRate {
  return value === 0 || value === 20 || value === 30;
}

export function rateForStatus(status: CisStatusName): CisRate | null {
  if (status === "GROSS") return 0;
  if (status === "STANDARD") return 20;
  if (status === "HIGHER") return 30;
  return null;
}

/** Nearest penny. Half a penny rounds up, which is the usual money rounding. */
export function cisDeductionPence(labourPence: number, rate: CisRate): number {
  if (rate === 0 || !Number.isInteger(labourPence) || labourPence <= 0) return 0;
  return Math.round((labourPence * rate) / 100);
}

export function suggestedCis(input: {
  traderStatus: CisStatusName;
  customerDeducts: boolean;
  customerOverride: number | null;
}): { applies: boolean; rate: CisRate; needsRate: boolean } {
  const override = isCisRate(input.customerOverride) ? input.customerOverride : null;
  if (!input.customerDeducts) {
    return { applies: false, rate: rateForStatus(input.traderStatus) ?? 20, needsRate: false };
  }
  if (override !== null) return { applies: true, rate: override, needsRate: false };
  const fromTrader = rateForStatus(input.traderStatus);
  if (fromTrader !== null) return { applies: true, rate: fromTrader, needsRate: false };
  return { applies: false, rate: 20, needsRate: true };
}

export function amountCustomerPays(input: {
  totalPence: number;
  cisApplies: boolean;
  amountDuePence: number;
}): number {
  if (!input.cisApplies) return input.totalPence;
  if (!Number.isInteger(input.amountDuePence) || input.amountDuePence < 0) return input.totalPence;
  return input.amountDuePence;
}

export type MoneyRow = { label: string; pence: number; deduct?: boolean; strong?: boolean };

export function invoiceMoneyRows(input: {
  labourPence: number;
  materialsPence: number;
  netPence: number;
  vatPence: number;
  vatRate: number;
  totalPence: number;
  cisApplies: boolean;
  cisRate: number;
  cisDeductionPence: number;
  amountDuePence: number;
}): MoneyRow[] {
  const rows: MoneyRow[] = [];
  if (input.cisApplies || input.materialsPence > 0) {
    rows.push({ label: "Labour", pence: input.labourPence });
    rows.push({ label: "Materials", pence: input.materialsPence });
  }
  rows.push({ label: "Net", pence: input.netPence });
  rows.push({ label: input.vatRate > 0 ? `VAT ${input.vatRate}%` : "VAT", pence: input.vatPence });
  rows.push({ label: "Total", pence: input.totalPence, strong: !input.cisApplies });
  if (input.cisApplies) {
    rows.push({
      label: `Less CIS ${input.cisRate}% on labour`,
      pence: input.cisDeductionPence,
      deduct: true,
    });
    rows.push({ label: "Amount to pay this business", pence: input.amountDuePence, strong: true });
  }
  return rows;
}

export function formatMoneyRow(row: MoneyRow): string {
  const amount = formatGBP(row.pence);
  return row.deduct ? `-${amount}` : amount;
}

export function splitForInvoice(input: {
  netPence: number;
  totalPence: number;
  labourRaw: string;
  materialsRaw: string;
  cisApplies: boolean;
  rateRaw: string;
}):
  | {
      ok: true;
      labourPence: number;
      materialsPence: number;
      cisApplies: boolean;
      cisRate: CisRate;
      cisDeductionPence: number;
      amountDuePence: number;
    }
  | { ok: false; error: string } {
  const labourPence = poundsToPence(input.labourRaw.trim());
  const materialsPence = poundsToPence(input.materialsRaw.trim());
  if (labourPence === null || materialsPence === null) {
    return { ok: false, error: "Enter labour and materials in pounds. Use 0.00 if there are none." };
  }
  if (labourPence + materialsPence !== input.netPence) {
    return {
      ok: false,
      error: `Labour and materials must add up to the net (${formatGBP(input.netPence)}). The deduction is worked out on the labour only.`,
    };
  }
  if (!input.cisApplies) {
    return {
      ok: true,
      labourPence,
      materialsPence,
      cisApplies: false,
      cisRate: 0,
      cisDeductionPence: 0,
      amountDuePence: input.totalPence,
    };
  }
  const rate = Number(input.rateRaw);
  if (!isCisRate(rate)) return { ok: false, error: "Choose gross (0%), 20% or 30%." };
  const deduction = cisDeductionPence(labourPence, rate);
  const amountDuePence = Math.max(0, input.totalPence - deduction);
  return {
    ok: true,
    labourPence,
    materialsPence,
    cisApplies: true,
    cisRate: rate,
    cisDeductionPence: deduction,
    amountDuePence,
  };
}
