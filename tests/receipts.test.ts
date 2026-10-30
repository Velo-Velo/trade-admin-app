import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { NOTE_FAILED, NOTE_NO_KEY, NOTE_READ, RECEIPT_RECORD_NOTE } from "@/lib/receipts/copy";
import { captureWhatsAppReceipt, traderForReceipt, type NewExpense, type ReceiptStore, type VerifiedTrader } from "@/lib/receipts/capture";
import { parseExpenseEdit, parseExtractedReceipt } from "@/lib/receipts/fields";
import { matchReceiptJob, type ReceiptJob } from "@/lib/receipts/match";
import { whatsappConnection } from "@/lib/whatsapp/client";
import { acceptReceiptPhoto, authoriseWebhook, listInboundPieces } from "@/lib/whatsapp/inbound";

const now = new Date("2026-10-30T12:00:00.000Z");

const outsideTap: ReceiptJob = {
  id: "job-tap",
  customerId: "cust-riley",
  title: "Outside tap is dripping",
  customerName: "Riley Sample",
  address: "14 Sample Street",
  postcode: "BS1 4ST",
};

const kitchenTap: ReceiptJob = {
  id: "job-kitchen",
  customerId: "cust-jones",
  title: "Replaced a kitchen tap",
  customerName: "Mrs Jones Sample",
  address: "8 Sample Road",
  postcode: "LS1 1AA",
};

const traderA: VerifiedTrader = {
  id: "trader-a",
  businessName: "Harbour Heating",
  slug: "harbour-heating",
  email: "harbour@example.com",
};

function sign(body: string, secret: string): string {
  return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
}

function memoryStore(options: { trader: VerifiedTrader | null; jobs?: ReceiptJob[] }): ReceiptStore & {
  expenses: NewExpense[];
  replies: string[];
  claimed: Set<string>;
} {
  const expenses: NewExpense[] = [];
  const replies: string[] = [];
  const claimed = new Set<string>();
  return {
    expenses,
    replies,
    claimed,
    async claim(externalId) {
      if (claimed.has(externalId)) return false;
      claimed.add(externalId);
      return true;
    },
    async findVerifiedTrader(phone) {
      if (phone !== "447700900100") return null;
      return options.trader;
    },
    async listJobs(traderId) {
      if (!options.trader || traderId !== options.trader.id) return [];
      return options.jobs ?? [];
    },
    async createExpense(expense) {
      expenses.push(expense);
      return { id: `expense-${expenses.length}` };
    },
    async remember() {},
    async reply(row) {
      replies.push(row.text);
    },
  };
}

const jpeg = Uint8Array.from([1, 2, 3, 4]);

describe("WhatsApp webhook", () => {
  const imageBody = JSON.stringify({
    entry: [
      {
        changes: [
          {
            value: {
              messages: [
                {
                  from: "447700900100",
                  id: "wamid.receipt-1",
                  type: "image",
                  image: { id: "media-1", mime_type: "image/jpeg", caption: "Screwfix for the outside tap" },
                },
              ],
            },
          },
        ],
      },
    ],
  });

  it("refuses a webhook when WhatsApp is not connected and when the signature is wrong", () => {
    expect(authoriseWebhook(imageBody, sign(imageBody, "app-secret"), undefined)).toEqual({
      ok: false,
      status: 501,
      error: "WhatsApp app secret is not set",
    });
    expect(authoriseWebhook(imageBody, sign(imageBody, "other"), "app-secret").ok).toBe(false);
    expect(authoriseWebhook("{", sign("{", "app-secret"), "app-secret")).toMatchObject({ ok: false, status: 400 });
    expect(whatsappConnection({})).toEqual({ connected: false });
    expect(
      whatsappConnection({
        WHATSAPP_TOKEN: "token",
        WHATSAPP_PHONE_NUMBER_ID: "123",
        WHATSAPP_VERIFY_TOKEN: "verify",
        WHATSAPP_APP_SECRET: "app-secret",
      }).connected,
    ).toBe(true);
  });

  it("reads an image, an image sent as a document, and leaves a PDF for a separate reply", () => {
    const auth = authoriseWebhook(imageBody, sign(imageBody, "app-secret"), "app-secret");
    expect(auth.ok).toBe(true);
    if (!auth.ok) return;
    expect(listInboundPieces(auth.payload)).toEqual([
      {
        kind: "image",
        from: "447700900100",
        id: "wamid.receipt-1",
        imageId: "media-1",
        mime: "image/jpeg",
        caption: "Screwfix for the outside tap",
      },
    ]);

    const mixed = {
      entry: [
        {
          changes: [
            {
              value: {
                messages: [
                  { from: "447700900100", id: "m-doc", type: "document", document: { id: "pdf-1", mime_type: "application/pdf" } },
                  { from: "447700900100", id: "m-img", type: "document", document: { id: "img-9", mime_type: "image/png", caption: "fuel" } },
                  { from: "447700900100", id: "m-text", type: "text", text: { body: "Invoice Mrs Jones, replaced tap, £80" } },
                ],
              },
            },
          ],
        },
      ],
    };
    expect(listInboundPieces(mixed).map((piece) => piece.kind)).toEqual(["unsupported", "image", "text"]);
  });

  it("creates one expense from a signed image and ignores the replay", async () => {
    const auth = authoriseWebhook(imageBody, sign(imageBody, "app-secret"), "app-secret");
    if (!auth.ok) throw new Error("expected a valid webhook");
    const [piece] = listInboundPieces(auth.payload);
    if (!piece || piece.kind !== "image") throw new Error("expected an image");
    const store = memoryStore({ trader: traderA, jobs: [outsideTap, kitchenTap] });
    let downloads = 0;
    const saved = await acceptReceiptPhoto({
      from: piece.from,
      id: piece.id,
      imageId: piece.imageId,
      caption: piece.caption,
      viaMeta: true,
      origin: "https://quotestick.test",
      now,
      read: async () => ({
        supplier: "Screwfix",
        description: "15mm copper pipe",
        spentOn: "2026-10-28",
        totalPence: 1860,
        vatPence: 310,
        category: "MATERIALS",
      }),
      download: async (mediaId) => {
        downloads += 1;
        expect(mediaId).toBe("media-1");
        return { bytes: jpeg, mime: "image/jpeg" };
      },
      prepare: async () => ({ ok: true, bytes: Buffer.from(jpeg), mimeType: "image/jpeg", width: 2, height: 2 }),
      store,
    });
    expect(saved.expenseId).toBe("expense-1");
    expect(store.expenses).toHaveLength(1);
    expect(store.expenses[0]).toMatchObject({
      traderId: "trader-a",
      supplier: "Screwfix",
      totalPence: 1860,
      vatPence: 310,
      spentOn: "2026-10-28",
      category: "MATERIALS",
      jobId: "job-tap",
      customerId: "cust-riley",
    });
    expect(store.replies[0]).toContain("https://quotestick.test/receipts/expense-1");
    expect(store.replies[0]).toContain("£18.60");
    expect(store.replies[0]).toContain("VAT shown on the receipt: £3.10");
    expect(store.replies[0]).toContain(RECEIPT_RECORD_NOTE);
    expect(store.replies[0]).not.toMatch(/HMRC filing|tax return submitted/i);

    const replay = await acceptReceiptPhoto({
      from: piece.from,
      id: piece.id,
      imageId: piece.imageId,
      caption: piece.caption,
      viaMeta: true,
      origin: "https://quotestick.test",
      read: async () => {
        throw new Error("should not read a replay");
      },
      download: async () => {
        throw new Error("should not download a replay");
      },
      prepare: async () => {
        throw new Error("should not prepare a replay");
      },
      store,
    });
    expect(replay.expenseId).toBeNull();
    expect(store.expenses).toHaveLength(1);
    expect(downloads).toBe(1);
  });
});

describe("receipt creation", () => {
  it("stores the photo for manual entry when no reader is connected", async () => {
    const store = memoryStore({ trader: traderA, jobs: [outsideTap] });
    const saved = await captureWhatsAppReceipt(
      {
        from: "07700900100",
        externalId: "wamid.manual",
        caption: "",
        viaMeta: true,
        image: { bytes: jpeg, mimeType: "image/jpeg", filename: "receipt.jpg" },
        prepareError: null,
        origin: "https://quotestick.test",
        read: null,
        now,
      },
      store,
    );
    expect(saved.expenseId).toBe("expense-1");
    expect(store.expenses[0]).toMatchObject({
      traderId: "trader-a",
      supplier: "",
      totalPence: null,
      vatPence: null,
      jobId: null,
      extractionNote: NOTE_NO_KEY,
    });
    expect(store.expenses[0].bytes).toEqual(jpeg);
    expect(store.replies[0]).toMatch(/type the supplier/i);
  });

  it("keeps the photo when the reader fails and does not invent VAT", async () => {
    const store = memoryStore({ trader: traderA });
    await captureWhatsAppReceipt(
      {
        from: "447700900100",
        externalId: "wamid.fail",
        caption: "fuel",
        viaMeta: false,
        image: { bytes: jpeg, mimeType: "image/jpeg", filename: "receipt.jpg" },
        prepareError: null,
        origin: "https://quotestick.test",
        read: async () => {
          throw new Error("model down");
        },
        now,
      },
      store,
    );
    expect(store.expenses[0].extractionNote).toBe(NOTE_FAILED);
    expect(store.expenses[0].vatPence).toBeNull();
    expect(store.expenses[0].totalPence).toBeNull();
    expect(store.replies[0]).toMatch(/type the supplier/i);
  });

  it("does not attach a receipt from an unverified or unknown number", async () => {
    const store = memoryStore({ trader: null });
    const saved = await captureWhatsAppReceipt(
      {
        from: "447700900999",
        externalId: "wamid.stranger",
        caption: "trader-a Screwfix",
        viaMeta: true,
        image: { bytes: jpeg, mimeType: "image/jpeg", filename: "receipt.jpg" },
        prepareError: null,
        origin: "https://quotestick.test",
        read: async () => ({ supplier: "Screwfix", totalPence: 100, vatPence: 20, category: "MATERIALS" }),
        now,
      },
      store,
    );
    expect(saved.expenseId).toBeNull();
    expect(store.expenses).toHaveLength(0);
    expect(store.replies[0]).toMatch(/not linked/);
    expect(store.replies[0]).toMatch(/LINK/);
    expect(traderForReceipt({ id: "t", whatsappVerifiedAt: null })).toBeNull();
    expect(traderForReceipt({ id: "t", whatsappVerifiedAt: now })?.id).toBe("t");
  });

  it("does not save a receipt when the photo cannot be downloaded", async () => {
    const store = memoryStore({ trader: traderA });
    let prepared = 0;
    const saved = await acceptReceiptPhoto({
      from: "447700900100",
      id: "wamid.missing",
      imageId: "gone",
      caption: "",
      viaMeta: true,
      origin: "https://quotestick.test",
      read: null,
      download: async () => null,
      prepare: async () => {
        prepared += 1;
        return { ok: false, error: "should not run" };
      },
      store,
    });
    expect(saved.expenseId).toBeNull();
    expect(prepared).toBe(0);
    expect(store.expenses).toHaveLength(0);
    expect(store.replies[0]).toMatch(/could not download/i);
  });

  it("leaves the job unset when the note matches more than one", async () => {
    const store = memoryStore({ trader: traderA, jobs: [outsideTap, kitchenTap] });
    await captureWhatsAppReceipt(
      {
        from: "447700900100",
        externalId: "wamid.many",
        caption: "tap",
        viaMeta: false,
        image: { bytes: jpeg, mimeType: "image/jpeg", filename: "receipt.jpg" },
        prepareError: null,
        origin: "https://quotestick.test",
        read: async () => ({ supplier: "Toolstation", totalPence: 500, vatPence: null, category: "MATERIALS", spentOn: "2026-10-01" }),
        now,
      },
      store,
    );
    expect(store.expenses[0].jobId).toBeNull();
    expect(store.expenses[0].vatPence).toBeNull();
    expect(store.expenses[0].extractionNote).toBe(NOTE_READ);
    expect(store.replies[0]).toMatch(/more than one job/);
    expect(store.replies[0]).toMatch(/No VAT amount was read/);
  });

  it("ignores a number that is not a UK mobile, even if the caption names an account", async () => {
    const store = memoryStore({ trader: traderA });
    const saved = await captureWhatsAppReceipt(
      {
        from: "12345",
        externalId: "wamid.bad-phone",
        caption: "trader-a",
        viaMeta: true,
        image: { bytes: jpeg, mimeType: "image/jpeg", filename: "receipt.jpg" },
        prepareError: null,
        origin: "https://quotestick.test",
        read: null,
      },
      store,
    );
    expect(saved.expenseId).toBeNull();
    expect(store.expenses).toHaveLength(0);
    expect(store.replies).toHaveLength(0);
  });
});

describe("receipt figures", () => {
  it("drops VAT that is not an integer, is larger than the total, or is a future date", () => {
    const parsed = parseExtractedReceipt(
      {
        supplier: "  BP  ",
        description: "Diesel",
        spentOn: "2026-11-02",
        totalPence: 4099,
        vatPence: 5000,
        category: "FUEL",
      },
      now,
    );
    expect(parsed).toMatchObject({ supplier: "BP", spentOn: null, totalPence: 4099, vatPence: null, category: "FUEL" });
    expect(parseExtractedReceipt({ totalPence: 12.5, vatPence: 0 }, now)).toMatchObject({ totalPence: null, vatPence: 0 });
    expect(parseExtractedReceipt("nope", now)).toBeNull();
    expect(matchReceiptJob([outsideTap], "")).toEqual({ kind: "none" });
    expect(matchReceiptJob([outsideTap], "outside tap")).toMatchObject({ kind: "one", jobId: "job-tap" });
  });

  it("lets a trader confirm only when the supplier, date and total are filled in", () => {
    const missing = parseExpenseEdit(
      { supplier: "", description: "", spentOn: "", total: "", vat: "", category: "FUEL", jobId: "", customerId: "" },
      "confirm",
    );
    expect(missing.ok).toBe(false);
    const saved = parseExpenseEdit(
      { supplier: "", description: "pipe", spentOn: "", total: "", vat: "", category: "MATERIALS", jobId: "job-tap", customerId: "" },
      "save",
    );
    expect(saved.ok).toBe(true);
    const confirmed = parseExpenseEdit(
      {
        supplier: "Screwfix",
        description: "pipe",
        spentOn: "2026-10-28",
        total: "18.60",
        vat: "",
        category: "MATERIALS",
        jobId: "job-tap",
        customerId: "someone-else",
      },
      "confirm",
    );
    expect(confirmed.ok).toBe(true);
    if (!confirmed.ok) return;
    expect(confirmed.data.totalPence).toBe(1860);
    expect(confirmed.data.vatPence).toBeNull();
    expect(confirmed.data.spentOn?.toISOString()).toBe("2026-10-28T00:00:00.000Z");
    const tooMuchVat = parseExpenseEdit(
      { supplier: "BP", description: "", spentOn: "2026-10-01", total: "10.00", vat: "12.00", category: "FUEL", jobId: "", customerId: "" },
      "confirm",
    );
    expect(tooMuchVat.ok).toBe(false);
  });
});
