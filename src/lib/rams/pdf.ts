import PDFDocument from "pdfkit";
import { RAMS_DISCLAIMER, RAMS_DISCLAIMER_SHORT } from "./disclaimer";
import { formatDate } from "../format";
import { RISK_KEY, riskBand, riskScore } from "./risk";

export type RamsPdfHazard = {
  activity: string;
  hazard: string;
  whoHarmed: string;
  likelihoodBefore: number;
  severityBefore: number;
  controls: string;
  likelihoodAfter: number;
  severityAfter: number;
};

export type RamsPdfInput = {
  number: string;
  title: string;
  status: "DRAFT" | "ISSUED" | "AWAITING_SIGNATURES" | "SIGNED";
  tradeLabel: string;
  businessName: string;
  logoText: string;
  brandColour: string;
  phone: string;
  tradingAddress: string;
  siteAddress: string;
  sitePostcode: string;
  clientName: string;
  clientRole: string;
  startOn: Date | null;
  finishOn: Date | null;
  scopeOfWork: string;
  competentName: string;
  competentRole: string;
  competentPhone: string;
  signedName: string;
  signedOn: Date | null;
  nearestHospital: string;
  emergencyNotes: string;
  firstAidNotes: string;
  welfareNotes: string;
  ppe: string;
  hazards: RamsPdfHazard[];
  steps: Array<{ detail: string }>;
  substances: Array<{ name: string; hazard: string; controls: string }>;
  permits: Array<{ name: string; required: boolean; detail: string }>;
  briefings: Array<{ operativeName: string; role: string; briefedOn: Date | null; signatureName: string; signaturePng?: Buffer | null }>;
  approverSignaturePng?: Buffer | null;
};

const INK = "#16181d";
const MUTED = "#3e453e";
const LINE = "#d7dbd4";
const PAPER = "#f7f6f3";
const BOTTOM = 790;

let paintContinued: (doc: PDFKit.PDFDocument) => number = () => 48;

export function brandHex(input: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(input) ? input : "#9f2d00";
}

function inkOn(hex: string): string {
  const red = Number.parseInt(hex.slice(1, 3), 16);
  const green = Number.parseInt(hex.slice(3, 5), 16);
  const blue = Number.parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;
  return luminance > 0.62 ? INK : "#fffdf8";
}

function statusPhrase(status: RamsPdfInput["status"]): string {
  if (status === "SIGNED" || status === "ISSUED") return "Fully signed";
  if (status === "AWAITING_SIGNATURES") return "Awaiting signatures — not fully signed";
  return "Draft — check before you send it";
}

function bandHex(label: string): string {
  if (label === "Low") return "#1f7a4d";
  if (label === "Medium") return "#8a5a00";
  if (label === "High") return "#9f2d00";
  return "#7c1020";
}

export function renderRamsPdf(input: RamsPdfInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40, bufferPages: true, compress: false });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const brand = brandHex(input.brandColour);
    const onBrand = inkOn(brand);
    const width = doc.page.width - 80;
    const paintHeader = (continued: boolean) => {
      doc.save();
      doc.rect(0, 0, doc.page.width, continued ? 36 : 78).fill(brand);
      doc.fillColor(onBrand).font("Helvetica-Bold");
      if (continued) {
        doc.fontSize(11).text(input.businessName, 40, 12, { width: 340, lineBreak: false });
        doc.font("Helvetica").fontSize(10).text(input.number, 380, 12, { width: 175, align: "right", lineBreak: false });
      } else {
        doc.fontSize(10).text(input.logoText || input.businessName, 40, 18, { width: 340, lineBreak: false });
        doc.fontSize(18).text(input.businessName, 40, 34, { width: 340, lineBreak: false });
        doc.font("Helvetica").fontSize(10).text("RAMS", 400, 20, { width: 155, align: "right", lineBreak: false });
        doc.font("Helvetica-Bold").fontSize(14).text(input.number, 400, 36, { width: 155, align: "right", lineBreak: false });
      }
      doc.restore();
      return continued ? 52 : 96;
    };
    paintContinued = () => paintHeader(true);

    let y = paintHeader(false);
    doc.fillColor(MUTED).font("Helvetica").fontSize(9);
    const seller = [input.tradingAddress, input.phone].filter(Boolean).join("  ·  ");
    if (seller) {
      doc.text(seller, 40, y, { width });
      y = doc.y + 8;
    }

    doc.fillColor(MUTED).font("Helvetica").fontSize(9).text("Risk assessment and method statement", 40, y, { width });
    y = doc.y + 2;
    doc.fillColor(INK).font("Helvetica-Bold").fontSize(14).text(input.title, 40, y, { width });
    y = doc.y + 2;
    doc.font("Helvetica").fontSize(9).fillColor(MUTED);
    const when = [input.startOn ? `Starts ${formatDate(input.startOn)}` : "", input.finishOn ? `Finishes ${formatDate(input.finishOn)}` : ""]
      .filter(Boolean)
      .join(" · ");
    doc.text(
      `${input.tradeLabel}   ·   ${statusPhrase(input.status)}${when ? `   ·   ${when}` : ""}`,
      40,
      y,
      { width },
    );
    y = doc.y + 10;

    y = box(doc, y, width, RAMS_DISCLAIMER, "#7c4a00", "#fff8eb");
    y += 12;

    y = heading(doc, y, "The job", brand);
    const site = [input.siteAddress, input.sitePostcode].filter(Boolean).join(", ") || "Not written in yet";
    const client = [input.clientRole, input.clientName].filter(Boolean).join(": ") || "Not written in yet";
    y = pair(doc, y, width, "Site", site);
    y = pair(doc, y, width, "Client", client);
    y = pair(doc, y, width, "Scope of work", input.scopeOfWork || "Not written in yet");
    doc.font("Helvetica").fontSize(8).fillColor(MUTED).text(
      "Where CDM 2015 applies, the client or the main contractor should see this RAMS before work starts. Quotestick does not decide whether CDM applies.",
      40,
      y,
      { width },
    );
    y = doc.y + 12;

    y = heading(doc, y, "Risk assessment", brand);
    doc.font("Helvetica").fontSize(8).fillColor(MUTED).text(RISK_KEY, 40, y, { width });
    y = doc.y + 8;
    if (input.hazards.length === 0) {
      y = paragraph(doc, y, width, "No hazards have been written in.");
    }
    for (const hazard of input.hazards) {
      const block = hazardBlockHeight(doc, width, hazard);
      y = ensure(doc, y, block);
      y = drawHazard(doc, y, width, hazard);
      y += 8;
    }

    y = heading(doc, y, "Personal protective equipment", brand);
    y = paragraph(doc, y, width, input.ppe.trim() || "None written in. Add what this job needs.");

    y = heading(doc, y, "Method statement", brand);
    if (input.steps.length === 0) y = paragraph(doc, y, width, "No method has been written in.");
    input.steps.forEach((step, index) => {
      const text = `${index + 1}.  ${step.detail}`;
      const height = doc.font("Helvetica").fontSize(9).heightOfString(text, { width });
      y = ensure(doc, y, height + 6);
      doc.fillColor(INK).font("Helvetica").fontSize(9).text(text, 40, y, { width });
      y = doc.y + 4;
    });
    y += 6;

    y = heading(doc, y, "COSHH substances", brand);
    if (input.substances.length === 0) y = paragraph(doc, y, width, "No substances listed. Add any product you will actually use.");
    for (const substance of input.substances) {
      const text = `${substance.name}. ${substance.hazard} ${substance.controls}`.trim();
      const height = doc.font("Helvetica").fontSize(9).heightOfString(text, { width });
      y = ensure(doc, y, height + 8);
      doc.font("Helvetica-Bold").fontSize(9).fillColor(INK).text(substance.name, 40, y, { width });
      doc.font("Helvetica").text(`${substance.hazard} ${substance.controls}`.trim(), 40, doc.y, { width });
      y = doc.y + 6;
    }

    y = heading(doc, y, "Permits", brand);
    if (input.permits.length === 0) y = paragraph(doc, y, width, "No permits listed.");
    for (const permit of input.permits) {
      const text = `${permit.required ? "Required" : "Not required"} — ${permit.name}. ${permit.detail}`;
      const height = doc.font("Helvetica").fontSize(9).heightOfString(text, { width });
      y = ensure(doc, y, height + 6);
      doc.font("Helvetica").fontSize(9).fillColor(INK).text(
        `${permit.required ? "Required — " : "Not required — "}${permit.name}. ${permit.detail}`,
        40,
        y,
        { width },
      );
      y = doc.y + 4;
    }
    y += 6;

    y = heading(doc, y, "Emergency, first aid and welfare", brand);
    y = pair(doc, y, width, "Nearest A&E", input.nearestHospital.trim() || "Not filled in. Write this in before work starts.");
    y = pair(doc, y, width, "Emergency", input.emergencyNotes);
    y = pair(doc, y, width, "First aid", input.firstAidNotes);
    y = pair(doc, y, width, "Welfare", input.welfareNotes);

    y = heading(doc, y, "Competent person", brand);
    y = paragraph(
      doc,
      y,
      width,
      "I have checked this RAMS. I am satisfied it describes this site and this scope, or I have changed it so that it does. I will stop the job if the site changes.",
    );
    y = pair(doc, y, width, "Name", input.competentName || "Not filled in");
    y = pair(doc, y, width, "Role", input.competentRole || "Competent person");
    if (input.competentPhone) y = pair(doc, y, width, "Phone", input.competentPhone);
    if (input.status !== "SIGNED" && input.status !== "ISSUED") {
      y = paragraph(doc, y, width, "This RAMS is not fully signed. Signatures from an older version are not shown. Everyone needs to sign the current version before you treat it as signed.");
    }
    if (input.approverSignaturePng && input.approverSignaturePng.length > 32) {
      y = ensure(doc, y, 48);
      doc.font("Helvetica-Bold").fontSize(9).fillColor(MUTED).text("Signed", 40, y, { width: 100 });
      doc.image(input.approverSignaturePng, 150, y, { fit: [180, 42] });
      const caption = input.signedName ? `${input.signedName}${input.signedOn ? `, ${formatDate(input.signedOn)}` : ""}` : "Signed";
      doc.font("Helvetica").fontSize(8).fillColor(INK).text(caption, 340, y + 14, { width: width - 300 });
      y += 50;
    } else {
      y = pair(doc, y, width, "Signed", "Not signed yet");
    }

    y = heading(doc, y, "Operative briefing", brand);
    y = paragraph(
      doc,
      y,
      width,
      "Each person confirms they have read this RAMS, understand the controls, know where the first-aid kit and the nearest A&E are, and will stop if the site changes.",
    );
    const rows = [...input.briefings];
    while (rows.length < 4) rows.push({ operativeName: "", role: "", briefedOn: null, signatureName: "" });
    y = ensure(doc, y, 22);
    y = briefingHead(doc, y);
    for (const row of rows) {
      const rowHeight = row.signaturePng && row.signaturePng.length > 32 ? 48 : 22;
      y = ensure(doc, y, rowHeight);
      if (y < 70) y = briefingHead(doc, y);
      y = briefingRow(doc, y, row);
    }

    const range = doc.bufferedPageRange();
    for (let page = range.start; page < range.start + range.count; page += 1) {
      doc.switchToPage(page);
      doc.font("Helvetica").fontSize(7.5).fillColor(MUTED);
      doc.text(
        `${RAMS_DISCLAIMER_SHORT}   ·   Page ${page - range.start + 1} of ${range.count}`,
        40,
        doc.page.height - 28,
        { width, align: "center", lineBreak: false, height: 12 },
      );
    }
    doc.end();
  });
}

function ensure(doc: PDFKit.PDFDocument, y: number, needed: number): number {
  if (y + needed <= BOTTOM) return y;
  doc.addPage();
  return paintContinued(doc);
}

function heading(doc: PDFKit.PDFDocument, y: number, title: string, brand: string): number {
  const next = ensure(doc, y, 28);
  doc.fillColor(brand).font("Helvetica-Bold").fontSize(12).text(title, 40, next, { width: doc.page.width - 80 });
  doc.moveTo(40, doc.y + 2).lineTo(doc.page.width - 40, doc.y + 2).strokeColor(brand).lineWidth(0.6).stroke();
  return doc.y + 8;
}

function pair(doc: PDFKit.PDFDocument, y: number, width: number, label: string, value: string): number {
  const body = value.trim() || "—";
  const height = doc.font("Helvetica").fontSize(9).heightOfString(body, { width: width - 110 });
  const next = ensure(doc, y, height + 8);
  doc.font("Helvetica-Bold").fontSize(9).fillColor(MUTED).text(label, 40, next, { width: 100 });
  doc.font("Helvetica").fontSize(9).fillColor(INK).text(body, 150, next, { width: width - 110 });
  return Math.max(doc.y, next + height) + 6;
}

function paragraph(doc: PDFKit.PDFDocument, y: number, width: number, text: string): number {
  const height = doc.font("Helvetica").fontSize(9).heightOfString(text, { width });
  const next = ensure(doc, y, height + 8);
  doc.font("Helvetica").fontSize(9).fillColor(INK).text(text, 40, next, { width });
  return doc.y + 8;
}

function box(doc: PDFKit.PDFDocument, y: number, width: number, text: string, ink: string, fill: string): number {
  const height = doc.font("Helvetica").fontSize(8).heightOfString(text, { width: width - 16 }) + 12;
  doc.save();
  doc.roundedRect(40, y, width, height, 4).fill(fill);
  doc.restore();
  doc.fillColor(ink).font("Helvetica").fontSize(8).text(text, 48, y + 6, { width: width - 16 });
  return y + height;
}

function hazardBlockHeight(doc: PDFKit.PDFDocument, width: number, hazard: RamsPdfHazard): number {
  const inner = width - 16;
  const activity = doc.font("Helvetica-Bold").fontSize(9).heightOfString(hazard.activity || "Hazard", { width: inner });
  const hazardText = doc.font("Helvetica").fontSize(8).heightOfString(hazard.hazard, { width: inner });
  const who = doc
    .font("Helvetica")
    .fontSize(8)
    .heightOfString(`Who might be harmed: ${hazard.whoHarmed || "Not written in"}`, { width: inner });
  const controls = doc.font("Helvetica").fontSize(8).heightOfString(hazard.controls, { width: inner });
  // Matches drawHazard: 6 top, 1 gaps, 3 before the rating line, 14 for the rating, 8 bottom.
  return 6 + activity + 1 + hazardText + 1 + who + 3 + 14 + controls + 8;
}

function drawHazard(doc: PDFKit.PDFDocument, y: number, width: number, hazard: RamsPdfHazard): number {
  const before = riskScore(hazard.likelihoodBefore, hazard.severityBefore);
  const after = riskScore(hazard.likelihoodAfter, hazard.severityAfter);
  const beforeBand = riskBand(before);
  const afterBand = riskBand(after);
  const height = hazardBlockHeight(doc, width, hazard);
  doc.save();
  doc.roundedRect(40, y, width, height, 4).lineWidth(0.6).strokeColor(LINE).stroke();
  doc.restore();
  let cursor = y + 6;
  doc.font("Helvetica-Bold").fontSize(9).fillColor(INK).text(hazard.activity || "Hazard", 48, cursor, { width: width - 16 });
  cursor = doc.y + 1;
  doc.font("Helvetica").fontSize(8).fillColor(INK).text(hazard.hazard, 48, cursor, { width: width - 16 });
  cursor = doc.y + 1;
  doc.fillColor(MUTED).text(`Who might be harmed: ${hazard.whoHarmed || "Not written in"}`, 48, cursor, { width: width - 16 });
  cursor = doc.y + 3;
  doc.font("Helvetica-Bold").fontSize(8).fillColor(bandHex(beforeBand.label)).text(
    `Before ${hazard.likelihoodBefore}×${hazard.severityBefore} = ${before} ${beforeBand.label}`,
    48,
    cursor,
    { width: (width - 16) / 2, lineBreak: false },
  );
  doc.fillColor(bandHex(afterBand.label)).text(
    `After ${hazard.likelihoodAfter}×${hazard.severityAfter} = ${after} ${afterBand.label}`,
    48 + (width - 16) / 2,
    cursor,
    { width: (width - 16) / 2, lineBreak: false },
  );
  cursor += 14;
  doc.font("Helvetica").fontSize(8).fillColor(INK).text(hazard.controls, 48, cursor, { width: width - 16 });
  return y + height;
}

const BRIEF_COLS = [150, 110, 90, 145];

function briefingHead(doc: PDFKit.PDFDocument, y: number): number {
  doc.rect(40, y, 495, 16).fill(PAPER);
  doc.font("Helvetica-Bold").fontSize(8).fillColor(MUTED);
  let x = 44;
  ["Name", "Role", "Date", "Signature"].forEach((label, index) => {
    doc.text(label, x, y + 4, { width: BRIEF_COLS[index] - 8, lineBreak: false });
    x += BRIEF_COLS[index];
  });
  return y + 16;
}

function briefingRow(
  doc: PDFKit.PDFDocument,
  y: number,
  row: { operativeName: string; role: string; briefedOn: Date | null; signatureName: string; signaturePng?: Buffer | null },
): number {
  const tall = Boolean(row.signaturePng && row.signaturePng.length > 32);
  const height = tall ? 48 : 20;
  doc.moveTo(40, y + height).lineTo(535, y + height).strokeColor(LINE).lineWidth(0.4).stroke();
  doc.font("Helvetica").fontSize(8).fillColor(INK);
  const values = [row.operativeName, row.role, row.briefedOn ? formatDate(row.briefedOn) : row.signaturePng ? "Signed" : ""];
  let x = 44;
  values.forEach((value, index) => {
    doc.text(value, x, y + 6, { width: BRIEF_COLS[index] - 8, lineBreak: false, height: 12 });
    x += BRIEF_COLS[index];
  });
  if (row.signaturePng && row.signaturePng.length > 32) {
    doc.image(row.signaturePng, x, y + 4, { fit: [BRIEF_COLS[3] - 12, 36] });
  }
  return y + height;
}
