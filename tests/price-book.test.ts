import { describe, expect, it } from "vitest";
import { deliver, availableChannels } from "../src/lib/channels";
import { poundsToPence, quoteTotals } from "../src/lib/format";
import { foregroundFor, slugify } from "../src/lib/brand";
import { applySplitstickReceipt, bearerMatches } from "../src/lib/price-book/splitstick";

describe("price book and delivery hooks", () => {
  it("keeps a sell price the trader already set when a Splitstick receipt arrives", () => {
    const created = applySplitstickReceipt(
      {
        source: "splitstick",
        receiptId: "r1",
        merchant: "Example Merchant",
        description: "15mm isolation valve",
        paidPence: 320,
        paidAt: "2026-10-01T09:00:00.000Z",
      },
      null,
    );
    expect(created.sellPricePence).toBe(416);
    expect(created.source).toBe("SPLITSTICK");

    const updated = applySplitstickReceipt(
      {
        source: "splitstick",
        receiptId: "r2",
        description: "15mm isolation valve",
        paidPence: 400,
        paidAt: "2026-10-10T09:00:00.000Z",
      },
      { sellPricePence: 900 },
    );
    expect(updated.sellPricePence).toBe(900);
    expect(updated.lastPaidPence).toBe(400);
  });

  it("compares bearer tokens without accepting a different length", () => {
    expect(bearerMatches("Bearer secret-token", "secret-token")).toBe(true);
    expect(bearerMatches("Bearer secret-token", "secret-tokem")).toBe(false);
    expect(bearerMatches("Bearer short", "secret-token")).toBe(false);
    expect(bearerMatches(null, "secret-token")).toBe(false);
    expect(bearerMatches("Bearer secret-token", undefined)).toBe(false);
  });

  it("rounds quote deposits in pence and parses pounds without binary drift", () => {
    expect(poundsToPence("12.50")).toBe(1250);
    expect(poundsToPence("12.5")).toBe(1250);
    expect(poundsToPence("12.555")).toBeNull();
    expect(
      quoteTotals(
        [{ kind: "MATERIAL", quantity: 1, unitPricePence: 1001 }],
        30,
      ).deposit,
    ).toBe(300);
  });

  it("picks readable text on a light brand colour", () => {
    expect(foregroundFor("#f6e27a")).toBe("#1c1915");
    expect(foregroundFor("#1f4a38")).toBe("#fffdf9");
    expect(slugify("North Quay Heating (demo)")).toBe("north-quay-heating-demo");
  });

  it("sends email and refuses WhatsApp until a sender is registered", async () => {
    expect(availableChannels()).toEqual(["email"]);
    await expect(
      deliver({ channel: "whatsapp", to: "+447000000000", subject: "Quote", text: "link" }),
    ).rejects.toThrow(/WhatsApp is not set up/);
  });
});
