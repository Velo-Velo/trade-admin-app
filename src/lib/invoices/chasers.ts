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
}): { subject: string; text: string } {
  const amount = formatGBP(input.totalPence);
  const due = formatDate(input.dueAt);
  const pay = input.paymentUrl
    ? `Card link: ${input.paymentUrl}`
    : "The invoice has the bank details. Card payment is not set up on this one.";
  const link = `Invoice: ${input.invoiceUrl}`;
  if (input.stage <= 0) {
    return {
      subject: `Invoice ${input.number} is due`,
      text: [
        `Hello ${input.customerName},`,
        "",
        `Invoice ${input.number} from ${input.businessName} for ${amount} is due on ${due}.`,
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
      "Please pay today, or contact us so we can sort it out.",
      pay,
      link,
    ].join("\n"),
  };
}
