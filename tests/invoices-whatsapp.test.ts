import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { customerInvoicePath, InvoiceNotApprovedError } from "@/lib/invoices/approval";
import { chaserCopy, isInvoiceChaserDue } from "@/lib/invoices/chasers";
import { parseInvoiceText } from "@/lib/invoices/parse";
import { splitVat } from "@/lib/invoices/vat";
import { isReviewDue } from "@/lib/reviews/sequence";
import { interpretInbound } from "@/lib/whatsapp/interpret";
import {
  approvedCustomerReply,
  customerChaseChannel,
  draftInvoiceReply,
  paymentNote,
} from "@/lib/whatsapp/plan";
import { verifyMetaSignature } from "@/lib/whatsapp/signature";
import { QuoteNotApprovedError } from "@/lib/quotes/approval";

const day = 24 * 60 * 60 * 1000;

describe("WhatsApp approval gate", () => {
  it("keeps draft invoices and quotes off the customer path", () => {
    expect(() => customerInvoicePath("DRAFT", "tok")).toThrow(InvoiceNotApprovedError);
    expect(() =>
      approvedCustomerReply({
        kind: "invoice",
        status: "DRAFT",
        number: "I-0001",
        publicToken: "tok",
        paymentNote: paymentNote(null),
      }),
    ).toThrow(InvoiceNotApprovedError);
    expect(() =>
      approvedCustomerReply({
        kind: "quote",
        status: "DRAFT",
        number: "Q-0001",
        publicToken: "tok",
        paymentNote: paymentNote(null),
      }),
    ).toThrow(QuoteNotApprovedError);

    const draft = draftInvoiceReply({
      number: "I-0004",
      customerName: "Mrs Jones",
      summary: "Replaced tap. £80.00.",
      traderUrl: "https://example.test/invoices/abc",
    });
    expect(draft.customerText).toBeNull();
    expect(draft.customerPath).toBeNull();
    expect(draft.traderText).toContain("APPROVE I-0004");
    expect(draft.traderText).toContain("Nothing has been sent");
    expect(draft.traderText).not.toContain("/i/");

    const sent = approvedCustomerReply({
      kind: "invoice",
      status: "SENT",
      number: "I-0004",
      publicToken: "public-token",
      paymentNote: paymentNote(null),
    });
    expect(sent.customerPath).toBe("/i/public-token");
    expect(sent.customerText).toContain("/i/public-token");
    expect(customerChaseChannel()).toBe("email");
  });

  it("reads link, approve, invoice and job messages", () => {
    expect(interpretInbound("LINK ab12cd")).toEqual({ type: "link", code: "AB12CD" });
    expect(interpretInbound("approve")).toEqual({ type: "approve", number: null });
    expect(interpretInbound("APPROVE i-0003")).toEqual({ type: "approve", number: "I-0003" });
    expect(interpretInbound("Invoice Mrs Jones, replaced tap, £80").type).toBe("invoice");
    expect(interpretInbound("Kitchen tap is dripping").type).toBe("job");
  });
});

describe("invoice parsing", () => {
  it("reads a short invoice message", () => {
    const parsed = parseInvoiceText("Invoice Mrs Jones, replaced tap, £80");
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.data.customerName).toBe("Mrs Jones");
    expect(parsed.data.description).toBe("replaced tap");
    expect(parsed.data.amountPence).toBe(8000);
    expect(parsed.data.vatExclusive).toBe(false);
    expect(parsed.data.dueDays).toBe(14);
  });

  it("treats plus VAT as extra and pulls a contact", () => {
    const parsed = parseInvoiceText(
      "Invoice Mrs Jones, replaced tap, £80 plus VAT, due in 7 days, mrs.jones@example.com",
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.data.vatExclusive).toBe(true);
    expect(parsed.data.dueDays).toBe(7);
    expect(parsed.data.contact).toBe("mrs.jones@example.com");
    expect(parsed.data.description).toBe("replaced tap");
    const vat = splitVat(parsed.data.amountPence, true, true);
    expect(vat.netPence).toBe(8000);
    expect(vat.vatPence).toBe(1600);
    expect(vat.totalPence).toBe(9600);
    const included = splitVat(8000, true, false);
    expect(included.totalPence).toBe(8000);
    expect(included.vatPence).toBe(1333);
    expect(included.netPence).toBe(6667);
    expect(splitVat(8000, false, false).vatPence).toBe(0);
  });

  it("rejects a message with no price", () => {
    expect(parseInvoiceText("Invoice Mrs Jones, replaced tap").ok).toBe(false);
    expect(parseInvoiceText("Please quote a new tap").ok).toBe(false);
  });
});

describe("late payment chasers", () => {
  const now = new Date("2026-10-17T09:00:00.000Z");

  function invoice(overrides: Partial<Parameters<typeof isInvoiceChaserDue>[0]> = {}) {
    return {
      status: "SENT",
      paidAt: null,
      chaserEnabled: true,
      chaserStage: 0,
      dueAt: new Date(now.getTime() - day),
      lastChasedAt: null,
      ...overrides,
    };
  }

  it("stops when the invoice is paid and waits for each step", () => {
    expect(isInvoiceChaserDue(invoice(), now)).toBe(true);
    expect(isInvoiceChaserDue(invoice({ status: "PAID", paidAt: now }), now)).toBe(false);
    expect(isInvoiceChaserDue(invoice({ paidAt: now, status: "SENT" }), now)).toBe(false);
    expect(isInvoiceChaserDue(invoice({ chaserEnabled: false }), now)).toBe(false);
    expect(isInvoiceChaserDue(invoice({ status: "DRAFT" }), now)).toBe(false);
    expect(isInvoiceChaserDue(invoice({ chaserStage: 3 }), now)).toBe(false);
    expect(isInvoiceChaserDue(invoice({ chaserStage: 1, dueAt: new Date(now.getTime() - 6 * day) }), now)).toBe(false);
    expect(isInvoiceChaserDue(invoice({ chaserStage: 1, dueAt: new Date(now.getTime() - 7 * day) }), now)).toBe(true);
    expect(isInvoiceChaserDue(invoice({ lastChasedAt: new Date(now.getTime() - 60 * 60 * 1000) }), now)).toBe(false);

    const polite = chaserCopy({
      stage: 0,
      businessName: "Sample Harbour Heating",
      number: "I-0001",
      customerName: "Mrs Jones",
      totalPence: 8000,
      dueAt: now,
      paymentUrl: null,
      invoiceUrl: "https://example.test/i/tok",
    });
    const firm = chaserCopy({
      stage: 2,
      businessName: "Sample Harbour Heating",
      number: "I-0001",
      customerName: "Mrs Jones",
      totalPence: 8000,
      dueAt: now,
      paymentUrl: "https://pay.example/abc",
      invoiceUrl: "https://example.test/i/tok",
    });
    expect(polite.subject).toMatch(/due/i);
    expect(firm.subject).toMatch(/14 days overdue/);
    expect(firm.text).toContain("https://pay.example/abc");
  });
});

describe("review chaser", () => {
  const now = new Date("2026-10-17T09:00:00.000Z");
  const base = {
    reviewChaserEnabled: true,
    traderEnabled: true,
    reviewStage: 0,
    reviewClickedAt: null,
    jobCompletedAt: new Date(now.getTime() - 2 * day),
    lastReviewAt: null,
    hasReviewUrl: true,
    hasEmail: true,
  };

  it("stops after the customer opens the review link", () => {
    expect(isReviewDue(base, now)).toBe(true);
    expect(isReviewDue({ ...base, reviewClickedAt: now }, now)).toBe(false);
    expect(isReviewDue({ ...base, reviewChaserEnabled: false }, now)).toBe(false);
    expect(isReviewDue({ ...base, reviewStage: 3 }, now)).toBe(false);
  });
});

describe("Meta webhook signature", () => {
  const body = '{"entry":[]}';
  const secret = "app-secret";
  const header = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;

  it("accepts a matching signature and rejects tampering", () => {
    expect(verifyMetaSignature(body, header, secret)).toBe(true);
    expect(verifyMetaSignature(body + " ", header, secret)).toBe(false);
    expect(verifyMetaSignature(body, header, "other-secret")).toBe(false);
    expect(verifyMetaSignature(body, "sha256=abcd", secret)).toBe(false);
    expect(verifyMetaSignature(body, null, secret)).toBe(false);
    expect(verifyMetaSignature(body, header, "")).toBe(false);
  });
});
