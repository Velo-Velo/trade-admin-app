import { customerInvoicePath, type InvoiceStatus } from "../invoices/approval";
import { deliveryForCustomer, type QuoteStatus } from "../quotes/approval";

export type PlannedMessages = {
  traderText: string;
  /** Null until the document is approved. The customer is never included on a draft. */
  customerText: string | null;
  customerPath: string | null;
};

export function draftQuoteReply(input: { number: string; summary: string; traderUrl: string }): PlannedMessages {
  return {
    traderText: [
      `Draft quote ${input.number} is ready for you to check.`,
      input.summary,
      "Nothing has been sent to the customer.",
      `Open it: ${input.traderUrl}`,
      `Reply APPROVE ${input.number} when it is right.`,
    ].join("\n"),
    customerText: null,
    customerPath: null,
  };
}

export function draftInvoiceReply(input: {
  number: string;
  customerName: string;
  summary: string;
  traderUrl: string;
}): PlannedMessages {
  return {
    traderText: [
      `Draft invoice ${input.number} for ${input.customerName}.`,
      input.summary,
      "Nothing has been sent to the customer.",
      `Open it: ${input.traderUrl}`,
      `Reply APPROVE ${input.number} to send it, or forward the PDF yourself.`,
    ].join("\n"),
    customerText: null,
    customerPath: null,
  };
}

export function draftRamsReply(input: { number: string; title: string; traderUrl: string; pdfUrl: string; signUrl?: string }): PlannedMessages {
  return {
    traderText: [
      `Draft ${input.number} is ready: ${input.title}.`,
      "It is filled from the checked hazard library. Check it suits this site before you send it on.",
      "Nothing has been sent to the customer or the main contractor.",
      `Open it: ${input.traderUrl}`,
      `PDF: ${input.pdfUrl}`,
      input.signUrl ? `Signing link, for the people doing the work: ${input.signUrl}` : "",
      "It is a drafting aid, not health and safety advice.",
    ]
      .filter(Boolean)
      .join("\n"),
    customerText: null,
    customerPath: null,
  };
}

/** Builds the customer message only after the approval gate has released the document. */
export function approvedCustomerReply(input: {
  kind: "quote" | "invoice";
  status: QuoteStatus | InvoiceStatus;
  number: string;
  publicToken: string;
  paymentNote: string;
}): PlannedMessages {
  const released =
    input.kind === "invoice"
      ? customerInvoicePath(input.status as InvoiceStatus, input.publicToken)
      : deliveryForCustomer(input.status as QuoteStatus, input.publicToken);
  const noun = input.kind === "invoice" ? "Invoice" : "Quote";
  return {
    traderText: [
      `${noun} ${input.number} is approved.`,
      `Customer link: ${released.path}`,
      input.paymentNote,
    ].join("\n"),
    customerText: [
      `${noun} ${input.number} is ready.`,
      released.path,
      input.paymentNote,
    ].join("\n"),
    customerPath: released.path,
  };
}

export function paymentNote(url: string | null): string {
  if (url) return `Card payment link: ${url}`;
  return "Card payments are not switched on, so there is no card link. No payment has been taken.";
}

/** Customer chasers go by email. WhatsApp to the customer can be added on this hook later. */
export function customerChaseChannel(): "email" {
  return "email";
}
