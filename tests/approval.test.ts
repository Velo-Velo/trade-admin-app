import { describe, expect, it } from "vitest";
import {
  acceptSentQuote,
  approveDraft,
  canViewQuotePublicly,
  declineSentQuote,
  deliveryForCustomer,
  QuoteNotApprovedError,
  resolvePublicQuoteView,
  validateQuoteLines,
} from "../src/lib/quotes/approval";

describe("quote approval gate", () => {
  const token = "public-token-that-already-exists";

  it("hides a draft from the public page even when the token is known", () => {
    expect(canViewQuotePublicly("DRAFT")).toBe(false);
    expect(resolvePublicQuoteView({ status: "DRAFT", publicToken: token })).toBeNull();
    expect(resolvePublicQuoteView(null)).toBeNull();
  });

  it("refuses to build a customer delivery for a draft", () => {
    expect(() => deliveryForCustomer("DRAFT", token)).toThrow(QuoteNotApprovedError);
    expect(() => deliveryForCustomer("DRAFT", token)).toThrow(/Approve it before/);
  });

  it("releases a draft only through approval, then allows the public link", () => {
    const status = approveDraft("DRAFT");
    expect(status).toBe("SENT");
    expect(deliveryForCustomer(status, token)).toEqual({ path: `/q/${token}` });
    expect(resolvePublicQuoteView({ status, publicToken: token })).toEqual({
      status: "SENT",
      publicToken: token,
    });
    expect(canViewQuotePublicly("ACCEPTED")).toBe(true);
    expect(canViewQuotePublicly("DECLINED")).toBe(true);
  });

  it("does not approve a quote that has already been sent", () => {
    expect(() => approveDraft("SENT")).toThrow(/Only a draft/);
    expect(() => approveDraft("ACCEPTED")).toThrow(/Only a draft/);
  });

  it("does not let a customer accept or decline before approval", () => {
    expect(() => acceptSentQuote("DRAFT")).toThrow(/Only a sent quote/);
    expect(() => declineSentQuote("DRAFT")).toThrow(/Only a sent quote/);
    expect(acceptSentQuote("SENT")).toBe("ACCEPTED");
    expect(declineSentQuote("SENT")).toBe("DECLINED");
  });

  it("rejects an empty quote before it can be saved or approved", () => {
    expect(validateQuoteLines([], 30)).toMatch(/at least one line/);
    expect(
      validateQuoteLines(
        [{ kind: "LABOUR", description: "Fit a tap", quantity: 1, unit: "hour", unitPricePence: 5000 }],
        30,
      ),
    ).toBeNull();
  });
});
