import { poundsToPence } from "../format";

export type ParsedInvoice = {
  customerName: string;
  description: string;
  amountPence: number;
  vatExclusive: boolean;
  dueDays: number;
  contact: string;
};

export function parseInvoiceText(
  input: string,
): { ok: true; data: ParsedInvoice } | { ok: false; error: string } {
  const text = input.trim().replace(/\s+/g, " ");
  if (!/^invoice\b/i.test(text)) {
    return { ok: false, error: "Start the message with Invoice, then the customer, the work, and a price." };
  }
  const vatExclusive = /\b(plus vat|\+ vat|ex vat|excluding vat)\b/i.test(text);
  const money = text.match(/£\s*(\d{1,6}(?:\.\d{1,2})?)|\b(\d{1,6}(?:\.\d{1,2})?)\s*(?:pounds|gbp)\b/i);
  if (!money) return { ok: false, error: "Include a price in pounds, such as £80." };
  const amountPence = poundsToPence(money[1] || money[2] || "");
  if (amountPence === null || amountPence <= 0) {
    return { ok: false, error: "Include a price greater than zero." };
  }

  let rest = text.replace(/^invoice\b[:\s]*/i, "");
  rest = rest.replace(money[0], " ");
  rest = rest.replace(/\b(plus vat|\+ vat|ex vat|excluding vat)\b/i, " ");

  let dueDays = 14;
  const due = rest.match(/\bdue(?:\s+in)?\s+(\d{1,3})\s+days?\b/i);
  if (due) {
    const days = Number(due[1]);
    if (days >= 0 && days <= 365) dueDays = days;
    rest = rest.replace(due[0], " ");
  }

  const email = rest.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  const phone = rest.match(/(?:\+44\s?|0)\d{9,12}\b/);
  let contact = "";
  if (email) {
    contact = email[0];
    rest = rest.replace(email[0], " ");
  } else if (phone) {
    contact = phone[0].replace(/\s+/g, " ").trim();
    rest = rest.replace(phone[0], " ");
  }

  rest = rest.replace(/\s+/g, " ").replace(/\s+,/g, ",").replace(/,+/g, ",").trim();
  rest = rest.replace(/^,+|,+$/g, "").trim();

  const parts = rest
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  let customerName = "";
  let description = "";
  if (parts.length >= 2) {
    customerName = parts[0];
    description = parts.slice(1).join(", ");
  } else {
    const forMatch = rest.match(/^(?:for\s+)?(.+?)\s+for\s+(.+)$/i);
    if (forMatch) {
      customerName = forMatch[1];
      description = forMatch[2];
    } else {
      customerName = rest;
      description = "Work done";
    }
  }
  customerName = customerName.replace(/^for\s+/i, "").replace(/[.\s]+$/g, "").trim();
  description = description.replace(/^for\s+/i, "").replace(/[.\s]+$/g, "").trim();
  if (customerName.length < 2 || customerName.length > 120) {
    return { ok: false, error: "Include the customer's name after Invoice." };
  }
  if (description.length < 2) description = "Work done";
  if (description.length > 2000) description = description.slice(0, 2000);

  return {
    ok: true,
    data: { customerName, description, amountPence, vatExclusive, dueDays, contact },
  };
}
