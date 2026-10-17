import { z } from "zod";

/**
 * Hook for Splitstick, a separate app that reads the trader's merchant receipts.
 * Nothing calls Splitstick from here. A future connection POSTs a receipt to
 * /api/integrations/splitstick, which uses applySplitstickReceipt.
 * Sell prices the trader has typed are kept. Last-paid fields are refreshed.
 */
export const splitstickReceiptSchema = z.object({
  source: z.literal("splitstick"),
  receiptId: z.string().min(1).max(120),
  merchant: z.string().max(120).optional(),
  description: z.string().min(2).max(240),
  paidPence: z.number().int().positive().max(10_000_000),
  paidAt: z.string().datetime(),
});

export type SplitstickReceiptPrice = z.infer<typeof splitstickReceiptSchema>;

export const splitstickPayloadSchema = z.object({
  email: z.string().email(),
  receipt: splitstickReceiptSchema,
});

/** 30% on materials when the trader has not set a sell price yet. */
export const DEFAULT_MATERIAL_MARKUP_BPS = 3000;

export type PriceBookWrite = {
  description: string;
  kind: "MATERIAL";
  lastPaidPence: number;
  lastPaidAt: Date;
  source: "SPLITSTICK";
  splitstickReceiptId: string;
  merchant: string | null;
  sellPricePence: number;
};

export function applySplitstickReceipt(
  receipt: SplitstickReceiptPrice,
  existing: { sellPricePence: number } | null,
): PriceBookWrite {
  const sellPricePence = existing
    ? existing.sellPricePence
    : Math.round((receipt.paidPence * (10_000 + DEFAULT_MATERIAL_MARKUP_BPS)) / 10_000);
  return {
    description: receipt.description,
    kind: "MATERIAL",
    lastPaidPence: receipt.paidPence,
    lastPaidAt: new Date(receipt.paidAt),
    source: "SPLITSTICK",
    splitstickReceiptId: receipt.receiptId,
    merchant: receipt.merchant ?? null,
    sellPricePence,
  };
}

export function bearerMatches(header: string | null, secret: string | undefined): boolean {
  if (!secret || !header?.startsWith("Bearer ")) return false;
  const provided = header.slice("Bearer ".length);
  if (provided.length !== secret.length) return false;
  let mismatch = 0;
  for (let index = 0; index < provided.length; index += 1) {
    mismatch |= provided.charCodeAt(index) ^ secret.charCodeAt(index);
  }
  return mismatch === 0;
}
