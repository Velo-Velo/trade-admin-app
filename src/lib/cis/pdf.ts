import PDFDocument from "pdfkit";
import { formatDate, formatGBP } from "../format";
import { CIS_STATEMENT_NOTE } from "./calc";
import { groupStatement, sumStatement, type StatementInvoice } from "./statement";

export function renderCisStatementPdf(input: {
  businessName: string;
  utr: string;
  taxYearLabel: string;
  rows: StatementInvoice[];
}): Promise<Buffer> {
  const groups = groupStatement(input.rows);
  const totals = sumStatement(input.rows);
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 48 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const writeHeader = () => {
      doc.font("Helvetica-Bold").fontSize(18).fillColor("#1c1915").text(input.businessName, { width: 500 });
      doc.moveDown(0.3);
      doc.font("Helvetica").fontSize(12).text(`CIS record ${input.taxYearLabel}`);
      if (input.utr) doc.text(`UTR ${input.utr}`);
      doc.moveDown(0.4);
      doc.fontSize(9).fillColor("#3f3a33").text(CIS_STATEMENT_NOTE, { width: 500 });
      doc.moveDown(0.8);
    };
    writeHeader();

    const columns = [48, 120, 250, 330, 400, 470];
    const headings = ["Invoice", "Customer", "Labour", "Deduction", "Rate", "Payable"];
    const drawHeadings = () => {
      doc.font("Helvetica-Bold").fontSize(9).fillColor("#1c1915");
      headings.forEach((heading, index) => {
        doc.text(heading, columns[index], doc.y, { width: index === 1 ? 120 : 70, lineBreak: false });
      });
      doc.moveDown(0.8);
      doc.moveTo(48, doc.y).lineTo(547, doc.y).strokeColor("#d9d1c3").stroke();
      doc.moveDown(0.4);
    };

    if (groups.length === 0) {
      doc.font("Helvetica").fontSize(11).fillColor("#1c1915").text("No approved invoices with a CIS deduction in this tax year.");
    }

    for (const group of groups) {
      if (doc.y > 700) doc.addPage();
      doc.font("Helvetica-Bold").fontSize(13).fillColor("#1c1915").text(group.label);
      doc.moveDown(0.3);
      drawHeadings();
      for (const row of group.rows) {
        if (doc.y > 740) {
          doc.addPage();
          drawHeadings();
        }
        const y = doc.y;
        doc.font("Helvetica").fontSize(9).fillColor("#1c1915");
        doc.text(row.number, columns[0], y, { width: 70, lineBreak: false });
        doc.text(row.customerName, columns[1], y, { width: 120, lineBreak: false });
        doc.text(formatGBP(row.labourPence), columns[2], y, { width: 70, lineBreak: false });
        doc.text(formatGBP(row.cisDeductionPence), columns[3], y, { width: 70, lineBreak: false });
        doc.text(`${row.cisRate}%`, columns[4], y, { width: 50, lineBreak: false });
        doc.text(formatGBP(row.amountDuePence), columns[5], y, { width: 70, lineBreak: false });
        doc.text(formatDate(row.issuedAt), columns[0], y + 12, { width: 200, lineBreak: false });
        doc.y = y + 30;
      }
      doc.moveDown(0.2);
      doc.font("Helvetica-Bold").fontSize(10).text(
        `${group.label} deduction ${formatGBP(group.totals.cisDeductionPence)} · payable to you ${formatGBP(group.totals.amountDuePence)}`,
      );
      doc.moveDown(0.8);
    }

    if (groups.length > 0) {
      if (doc.y > 700) doc.addPage();
      doc.font("Helvetica-Bold").fontSize(12).fillColor("#1c1915").text("Year total");
      doc.moveDown(0.3);
      doc.font("Helvetica").fontSize(11);
      doc.text(`Labour ${formatGBP(totals.labourPence)}`);
      doc.text(`Materials ${formatGBP(totals.materialsPence)}`);
      doc.text(`VAT ${formatGBP(totals.vatPence)}`);
      doc.text(`Gross ${formatGBP(totals.totalPence)}`);
      doc.text(`CIS deduction ${formatGBP(totals.cisDeductionPence)}`);
      doc.font("Helvetica-Bold").text(`Amount payable to this business ${formatGBP(totals.amountDuePence)}`);
      doc.moveDown(0.6);
      doc.font("Helvetica").fontSize(9).fillColor("#3f3a33").text(`${totals.count} invoice${totals.count === 1 ? "" : "s"}. Draft invoices are not included.`);
    }

    doc.end();
  });
}
