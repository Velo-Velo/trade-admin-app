import PDFDocument from "pdfkit";
import { formatDate, formatGBP } from "../format";

export type InvoicePdfInput = {
  number: string;
  status: string;
  businessName: string;
  phone: string;
  tradingAddress: string;
  vatNumber: string;
  vatRate: number;
  customerName: string;
  customerContact: string;
  description: string;
  netPence: number;
  vatPence: number;
  totalPence: number;
  dueAt: Date;
  issuedAt: Date;
  bankAccountName: string;
  bankSortCode: string;
  bankAccountNumber: string;
  paymentUrl: string | null;
};

export function renderInvoicePdf(input: InvoicePdfInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 48 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.rect(0, 0, doc.page.width, 92).fill("#1f4a38");
    doc.fillColor("#fffdf8").font("Helvetica-Bold").fontSize(22).text(input.businessName, 48, 32, { width: 360 });
    doc.font("Helvetica").fontSize(11).text("Invoice", 430, 36, { align: "right", width: 110 });
    doc.font("Helvetica-Bold").fontSize(14).text(input.number, 430, 52, { align: "right", width: 110 });

    doc.fillColor("#1c1915");
    let y = 116;
    doc.font("Helvetica").fontSize(10);
    const seller = [
      input.tradingAddress,
      input.phone,
      input.vatRate > 0 && input.vatNumber ? `VAT number ${input.vatNumber}` : "VAT is not charged",
    ]
      .filter(Boolean)
      .join("\n");
    doc.text(seller, 48, y, { width: 250 });
    doc.text(
      [`Issued ${formatDate(input.issuedAt)}`, `Due ${formatDate(input.dueAt)}`, input.status === "PAID" ? "Paid" : ""]
        .filter(Boolean)
        .join("\n"),
      330,
      y,
      { width: 210, align: "right" },
    );

    y = 210;
    doc.font("Helvetica-Bold").fontSize(12).text("To", 48, y);
    doc.font("Helvetica").fontSize(11).text(input.customerName, 48, y + 18);
    if (input.customerContact) doc.text(input.customerContact, 48, y + 34);

    y = 280;
    doc.font("Helvetica-Bold").fontSize(12).text("Work", 48, y);
    doc.font("Helvetica").fontSize(11).text(input.description, 48, y + 18, { width: 500 });

    y = Math.max(doc.y + 24, 380);
    doc.moveTo(48, y).lineTo(547, y).strokeColor("#d9d1c3").stroke();
    y += 16;
    const row = (label: string, value: string, bold = false) => {
      doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(bold ? 13 : 11);
      doc.text(label, 300, y, { width: 120 });
      doc.text(value, 420, y, { width: 127, align: "right" });
      y += bold ? 22 : 18;
    };
    row("Net", formatGBP(input.netPence));
    row(input.vatRate > 0 ? `VAT ${input.vatRate}%` : "VAT", formatGBP(input.vatPence));
    row("Total", formatGBP(input.totalPence), true);

    y += 12;
    doc.font("Helvetica").fontSize(10).fillColor("#3f3a33");
    if (input.vatRate > 0) {
      doc.text("The total includes VAT at the standard UK rate.", 48, y, { width: 240 });
    } else {
      doc.text("No VAT has been added. This business is not VAT registered on this invoice.", 48, y, { width: 240 });
    }

    y += 56;
    doc.fillColor("#1c1915").font("Helvetica-Bold").fontSize(12).text("How to pay", 48, y);
    y += 18;
    doc.font("Helvetica").fontSize(11);
    if (input.bankAccountName && input.bankSortCode && input.bankAccountNumber) {
      doc.text(`Account name ${input.bankAccountName}`, 48, y);
      doc.text(`Sort code ${input.bankSortCode}`, 48, y + 16);
      doc.text(`Account number ${input.bankAccountNumber}`, 48, y + 32);
      doc.text(`Reference ${input.number}`, 48, y + 48);
      y += 72;
    } else {
      doc.text("Bank details have not been added on this invoice.", 48, y);
      y += 20;
    }
    if (input.paymentUrl) {
      doc.text(`Card payment: ${input.paymentUrl}`, 48, y, { width: 500 });
    } else {
      doc.text("Card payment is not set up. No card payment has been taken.", 48, y, { width: 500 });
    }

    doc.fontSize(8).fillColor("#6b645b").text(
      "Quotestick prepared this invoice for the trader. It is not a tax return and it is not legal advice.",
      48,
      780,
      { width: 500 },
    );
    doc.end();
  });
}
