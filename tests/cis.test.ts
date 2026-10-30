import { describe, expect, it } from "vitest";
import {
  CIS_INVOICE_NOTE,
  CIS_STATEMENT_NOTE,
  amountCustomerPays,
  cisDeductionPence,
  invoiceMoneyRows,
  splitForInvoice,
  suggestedCis,
} from "@/lib/cis/calc";
import { parseCisProfile, parseCustomerCis } from "@/lib/cis/settings";
import { renderCisStatementPdf } from "@/lib/cis/pdf";
import { renderInvoicePdf } from "@/lib/invoices/pdf";
import { chaserCopy } from "@/lib/invoices/chasers";
import {
  groupStatement,
  statementCsv,
  sumStatement,
  taxYearBounds,
  taxYearContaining,
  type StatementInvoice,
} from "@/lib/cis/statement";

describe("CIS deduction", () => {
  it("takes the percentage from labour only and rounds half a penny up", () => {
    expect(cisDeductionPence(100000, 20)).toBe(20000);
    expect(cisDeductionPence(100000, 30)).toBe(30000);
    expect(cisDeductionPence(100000, 0)).toBe(0);
    expect(cisDeductionPence(10001, 30)).toBe(3000);
    expect(cisDeductionPence(5, 30)).toBe(2);
    expect(cisDeductionPence(1, 20)).toBe(0);
    expect(cisDeductionPence(0, 20)).toBe(0);
    expect(cisDeductionPence(-100, 20)).toBe(0);
  });

  it("keeps materials and VAT out of the deduction", () => {
    const split = splitForInvoice({
      netPence: 15000,
      totalPence: 18000,
      labourRaw: "100.00",
      materialsRaw: "50.00",
      cisApplies: true,
      rateRaw: "20",
    });
    expect(split).toMatchObject({
      ok: true,
      labourPence: 10000,
      materialsPence: 5000,
      cisRate: 20,
      cisDeductionPence: 2000,
      amountDuePence: 16000,
    });
  });

  it("refuses a split that does not match the net", () => {
    const split = splitForInvoice({
      netPence: 8000,
      totalPence: 8000,
      labourRaw: "70.00",
      materialsRaw: "20.00",
      cisApplies: true,
      rateRaw: "20",
    });
    expect(split.ok).toBe(false);
    if (!split.ok) expect(split.error).toMatch(/add up to the net/);
  });

  it("clears the deduction when CIS is switched off", () => {
    const split = splitForInvoice({
      netPence: 8000,
      totalPence: 8000,
      labourRaw: "50.00",
      materialsRaw: "30.00",
      cisApplies: false,
      rateRaw: "20",
    });
    expect(split).toMatchObject({
      ok: true,
      cisApplies: false,
      cisDeductionPence: 0,
      amountDuePence: 8000,
      materialsPence: 3000,
    });
  });

  it("uses the customer rate, then the trader status", () => {
    expect(suggestedCis({ traderStatus: "STANDARD", customerDeducts: true, customerOverride: null })).toEqual({
      applies: true,
      rate: 20,
      needsRate: false,
    });
    expect(suggestedCis({ traderStatus: "STANDARD", customerDeducts: true, customerOverride: 30 })).toEqual({
      applies: true,
      rate: 30,
      needsRate: false,
    });
    expect(suggestedCis({ traderStatus: "GROSS", customerDeducts: true, customerOverride: null }).rate).toBe(0);
    expect(suggestedCis({ traderStatus: "NOT_USED", customerDeducts: true, customerOverride: null }).needsRate).toBe(true);
    expect(suggestedCis({ traderStatus: "HIGHER", customerDeducts: false, customerOverride: 20 }).applies).toBe(false);
  });

  it("charges the invoice total when no CIS deduction is recorded", () => {
    expect(amountCustomerPays({ totalPence: 8000, cisApplies: false, amountDuePence: 0 })).toBe(8000);
    expect(amountCustomerPays({ totalPence: 100000, cisApplies: true, amountDuePence: 84000 })).toBe(84000);
  });

  it("labels the rows for the invoice and keeps the record-keeping wording", () => {
    const rows = invoiceMoneyRows({
      labourPence: 80000,
      materialsPence: 20000,
      netPence: 100000,
      vatPence: 0,
      vatRate: 0,
      totalPence: 100000,
      cisApplies: true,
      cisRate: 20,
      cisDeductionPence: 16000,
      amountDuePence: 84000,
    });
    expect(rows.map((row) => row.label)).toContain("Less CIS 20% on labour");
    expect(rows.at(-1)).toMatchObject({ label: "Amount to pay this business", pence: 84000, strong: true });
    expect(CIS_INVOICE_NOTE).toMatch(/does not send it to HMRC/);
    expect(CIS_INVOICE_NOTE).toMatch(/does not give tax advice/);
    expect(CIS_STATEMENT_NOTE).toMatch(/not a CIS return/i);
  });
});

describe("CIS statement", () => {
  const row = (over: Partial<StatementInvoice> = {}): StatementInvoice => ({
    id: "inv",
    number: "I-0004",
    customerName: "Sample Contractors Ltd",
    issuedAt: new Date("2026-10-28T00:00:00.000Z"),
    labourPence: 80000,
    materialsPence: 20000,
    netPence: 100000,
    vatPence: 0,
    totalPence: 100000,
    cisRate: 20,
    cisDeductionPence: 16000,
    amountDuePence: 84000,
    status: "SENT",
    ...over,
  });

  it("uses the UK tax year from 6 April", () => {
    expect(taxYearContaining(new Date("2026-04-05T00:00:00.000Z")).label).toBe("2025/26");
    expect(taxYearContaining(new Date("2026-04-06T00:00:00.000Z")).label).toBe("2026/27");
    expect(taxYearContaining(new Date("2026-10-30T12:00:00.000Z")).startYear).toBe(2026);
    const bounds = taxYearBounds(2026);
    expect(bounds.start.toISOString()).toBe("2026-04-06T00:00:00.000Z");
    expect(bounds.end.toISOString().startsWith("2027-04-05")).toBe(true);
  });

  it("sums a month and leaves materials out of the deduction total", () => {
    const rows = [
      row(),
      row({
        id: "inv-2",
        number: "I-0005",
        issuedAt: new Date("2026-11-02T00:00:00.000Z"),
        labourPence: 10000,
        materialsPence: 50000,
        cisDeductionPence: 3000,
        cisRate: 30,
        amountDuePence: 57000,
        netPence: 60000,
        totalPence: 60000,
      }),
    ];
    expect(sumStatement(rows).cisDeductionPence).toBe(19000);
    expect(sumStatement(rows).materialsPence).toBe(70000);
    expect(sumStatement(rows).amountDuePence).toBe(141000);
    const months = groupStatement(rows);
    expect(months.map((month) => month.key)).toEqual(["2026-10", "2026-11"]);
    expect(months[0].totals.cisDeductionPence).toBe(16000);
  });

  it("writes a CSV an accountant can open, with the record-keeping note", () => {
    const csv = statementCsv({
      businessName: "Sample Harbour Heating",
      utr: "1234567890",
      taxYearLabel: "2026/27",
      rows: [row({ customerName: 'Harbour "Main" Ltd' })],
    });
    expect(csv).toContain("CIS deduction");
    expect(csv).toContain("800.00");
    expect(csv).toContain("160.00");
    expect(csv).toContain("840.00");
    expect(csv).toContain('Harbour ""Main"" Ltd');
    expect(csv).toMatch(/not a CIS return/i);
    expect(csv).not.toMatch(/filed with HMRC/i);
  });

  it("asks the customer for the amount payable to the business", () => {
    const copy = chaserCopy({
      stage: 0,
      businessName: "Sample Harbour Heating",
      number: "I-0004",
      customerName: "Sample Contractors Ltd",
      totalPence: 100000,
      amountDuePence: 84000,
      cisApplies: true,
      cisDeductionPence: 16000,
      dueAt: new Date("2026-11-11T00:00:00.000Z"),
      paymentUrl: null,
      invoiceUrl: "https://example.test/i/tok",
    });
    expect(copy.text).toContain("£840.00");
    expect(copy.text).toContain("£160.00");
    expect(copy.text).toMatch(/not sent the deduction to HMRC/i);
  });
});

describe("CIS profile", () => {
  it("stores a 10-digit UTR and refuses anything else", () => {
    expect(parseCisProfile({ status: "STANDARD", utr: "123 456 7890" })).toMatchObject({ ok: true, cisUtr: "1234567890" });
    expect(parseCisProfile({ status: "GROSS", utr: "" })).toMatchObject({ ok: true, cisStatus: "GROSS", cisUtr: "" });
    expect(parseCisProfile({ status: "NOPE", utr: "" }).ok).toBe(false);
    const bad = parseCisProfile({ status: "STANDARD", utr: "123" });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error).toMatch(/not sent to HMRC/);
  });

  it("lets a customer keep the trader rate or override it", () => {
    expect(parseCustomerCis({ deducts: true, override: "" })).toEqual({ ok: true, deductsCis: true, cisRateOverride: null });
    expect(parseCustomerCis({ deducts: true, override: "30" })).toMatchObject({ ok: true, cisRateOverride: 30 });
    expect(parseCustomerCis({ deducts: false, override: "15" }).ok).toBe(false);
  });
});

describe("CIS documents", () => {
  it("renders a statement and an invoice PDF", async () => {
    const statement = await renderCisStatementPdf({
      businessName: "Sample Harbour Heating",
      utr: "1234567890",
      taxYearLabel: "2026/27",
      rows: [
        {
          id: "inv",
          number: "I-0004",
          customerName: "Sample Contractors Ltd",
          issuedAt: new Date("2026-10-28T00:00:00.000Z"),
          labourPence: 80000,
          materialsPence: 20000,
          netPence: 100000,
          vatPence: 0,
          totalPence: 100000,
          cisRate: 20,
          cisDeductionPence: 16000,
          amountDuePence: 84000,
          status: "SENT",
        },
      ],
    });
    expect(statement.subarray(0, 5).toString()).toBe("%PDF-");
    const invoice = await renderInvoicePdf({
      number: "I-0004",
      status: "SENT",
      businessName: "Sample Harbour Heating",
      phone: "07000 000000",
      tradingAddress: "Sample address",
      vatNumber: "",
      vatRate: 0,
      customerName: "Sample Contractors Ltd",
      customerContact: "accounts.sample@example.com",
      description: "First fix pipework",
      netPence: 100000,
      vatPence: 0,
      totalPence: 100000,
      labourPence: 80000,
      materialsPence: 20000,
      cisApplies: true,
      cisRate: 20,
      cisDeductionPence: 16000,
      amountDuePence: 84000,
      dueAt: new Date("2026-11-11T00:00:00.000Z"),
      issuedAt: new Date("2026-10-28T00:00:00.000Z"),
      bankAccountName: "Sample Harbour Heating",
      bankSortCode: "00-00-00",
      bankAccountNumber: "00000000",
      paymentUrl: null,
    });
    expect(invoice.subarray(0, 5).toString()).toBe("%PDF-");
  });
});
