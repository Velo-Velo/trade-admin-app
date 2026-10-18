export const QUOTE_STATUSES = ["DRAFT", "SENT", "ACCEPTED", "DECLINED", "LOST"] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export class QuoteNotApprovedError extends Error {
  readonly code = "QUOTE_NOT_APPROVED";

  constructor(
    message = "This quote is still a draft. Approve it before it can be sent or opened by the customer.",
  ) {
    super(message);
    this.name = "QuoteNotApprovedError";
  }
}

/** A customer may open the public link only after the trader has approved it. A lost quote stays open so they can see it is closed. */
export function canViewQuotePublicly(status: QuoteStatus): boolean {
  return status === "SENT" || status === "ACCEPTED" || status === "DECLINED" || status === "LOST";
}

/**
 * Returns the quote when the customer is allowed to see it.
 * A draft is treated the same as a missing quote so the public URL does not leak it.
 */
export function resolvePublicQuoteView<T extends { status: QuoteStatus }>(quote: T | null): T | null {
  if (!quote || !canViewQuotePublicly(quote.status)) return null;
  return quote;
}

/** The only transition that releases a quote. Draft becomes sent. */
export function approveDraft(status: QuoteStatus): "SENT" {
  if (status !== "DRAFT") {
    throw new Error("Only a draft quote can be approved.");
  }
  return "SENT";
}

/** Builds the customer path. Refuses drafts even if a public token already exists. */
export function deliveryForCustomer(status: QuoteStatus, publicToken: string): { path: string } {
  if (!canViewQuotePublicly(status)) {
    throw new QuoteNotApprovedError();
  }
  if (!publicToken) {
    throw new Error("Missing public token.");
  }
  return { path: `/q/${publicToken}` };
}

export function acceptSentQuote(status: QuoteStatus): "ACCEPTED" {
  if (status !== "SENT") {
    throw new Error("Only a sent quote can be accepted.");
  }
  return "ACCEPTED";
}

export function declineSentQuote(status: QuoteStatus): "DECLINED" {
  if (status !== "SENT") {
    throw new Error("Only a sent quote can be declined.");
  }
  return "DECLINED";
}

/** The trader closes a sent quote that the customer has not answered. */
export function markQuoteLost(status: QuoteStatus): "LOST" {
  if (status !== "SENT") {
    throw new Error("Only a sent quote can be marked lost.");
  }
  return "LOST";
}

export type QuoteLineInput = {
  kind: "LABOUR" | "MATERIAL";
  description: string;
  quantity: number;
  unit: string;
  unitPricePence: number;
  priceBookItemId?: string | null;
  lastPaidPence?: number | null;
};

export function validateQuoteLines(lines: QuoteLineInput[], depositPercent: number): string | null {
  if (!Number.isInteger(depositPercent) || depositPercent < 0 || depositPercent > 100) {
    return "Deposit percent must be a whole number from 0 to 100.";
  }
  if (lines.length === 0) return "Add at least one line before saving.";
  if (lines.length > 40) return "A quote can have at most 40 lines.";
  for (const line of lines) {
    if (line.kind !== "LABOUR" && line.kind !== "MATERIAL") {
      return "Each line must be labour or materials.";
    }
    if (line.description.trim().length < 2) return "Each line needs a description.";
    if (line.description.trim().length > 240) return "A line description is too long.";
    if (!(line.quantity > 0) || line.quantity > 10000) return "Quantity must be greater than zero.";
    if (!line.unit.trim() || line.unit.trim().length > 24) {
      return "Each line needs a unit, such as hour or item.";
    }
    if (
      !Number.isInteger(line.unitPricePence) ||
      line.unitPricePence < 0 ||
      line.unitPricePence > 10_000_000
    ) {
      return "Enter a valid price for each line.";
    }
  }
  return null;
}
