import { formatDate, formatGBP } from "../format";

/** Days after the due date: due date, one week later, two weeks later. */
export const CHASER_OFFSETS_DAYS = [0, 7, 14] as const;

export type ChaserInvoice = {
  status: string;
  paidAt: Date | null;
  chaserEnabled: boolean;
  chaserStage: number;
  dueAt: Date;
  lastChasedAt: Date | null;
};

const DAY = 24 * 60 * 60 * 1000;

export function isInvoiceChaserDue(invoice: ChaserInvoice, now: Date): boolean {
  if (!invoice.chaserEnabled) return false;
  if (invoice.paidAt) return false;
  if (invoice.status !== "SENT") return false;
  if (invoice.chaserStage < 0 || invoice.chaserStage >= CHASER_OFFSETS_DAYS.length) return false;
  const offset = CHASER_OFFSETS_DAYS[invoice.chaserStage];
  const sendAt = invoice.dueAt.getTime() + offset * DAY;
  if (now.getTime() < sendAt) return false;
  if (invoice.lastChasedAt && now.getTime() - invoice.lastChasedAt.getTime() < DAY) return false;
  return true;
}

export function chaserCopy(input: {
  stage: number;
  businessName: string;
  number: string;
  customerName: string;
  totalPence: number;
  dueAt: Date;
  paymentUrl: string | null;
  invoiceUrl: string;
  cisApplies?: boolean;
  cisDeductionPence?: number;
  amountDuePence?: number;
}): { subject: string; text: string } {
  const payable = input.cisApplies ? (input.amountDuePence ?? input.totalPence) : input.totalPence;
  const amount = formatGBP(payable);
  const cisLine =
    input.cisApplies && (input.cisDeductionPence ?? 0) > 0
      ? `This invoice records a CIS deduction of ${formatGBP(input.cisDeductionPence ?? 0)}. The amount above is what to pay this business. Quotestick has not sent the deduction to HMRC.`
      : "";
  const due = formatDate(input.dueAt);
  const pay = input.paymentUrl
    ? `Card link: ${input.paymentUrl}`
    : "Pay from the invoice page. The card button is there when card payments are switched on. Otherwise use the bank details.";
  const link = `Invoice: ${input.invoiceUrl}`;
  if (input.stage <= 0) {
    return {
      subject: `Invoice ${input.number} is due`,
      text: [
        `Hello ${input.customerName},`,
        "",
        `Invoice ${input.number} from ${input.businessName} for ${amount} is due on ${due}.`,
        ...(cisLine ? [cisLine] : []),
        pay,
        link,
        "",
        "Thank you.",
      ].join("\n"),
    };
  }
  if (input.stage === 1) {
    return {
      subject: `Invoice ${input.number} is a week overdue`,
      text: [
        `Hello ${input.customerName},`,
        "",
        `Invoice ${input.number} from ${input.businessName} for ${amount} was due on ${due} and is still unpaid.`,
        ...(cisLine ? [cisLine] : []),
        "Please pay it when you can, or reply if something on the invoice is wrong.",
        pay,
        link,
      ].join("\n"),
    };
  }
  return {
    subject: `Invoice ${input.number} is 14 days overdue`,
    text: [
      `Hello ${input.customerName},`,
      "",
      `We still have not received payment for invoice ${input.number} from ${input.businessName} (${amount}), which was due on ${due}.`,
      ...(cisLine ? [cisLine] : []),
      "Please pay today, or contact us so we can sort it out.",
      pay,
      link,
    ].join("\n"),
  };
}
