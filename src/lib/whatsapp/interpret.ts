export type InboundIntent =
  | { type: "link"; code: string }
  | { type: "approve"; number: string | null }
  | { type: "invoice"; raw: string }
  | { type: "job"; text: string }
  | { type: "empty" };

export function interpretInbound(text: string): InboundIntent {
  const trimmed = text.trim();
  if (!trimmed) return { type: "empty" };
  const link = trimmed.match(/^link\s+([A-Za-z0-9]{6})\s*$/i);
  if (link) return { type: "link", code: link[1].toUpperCase() };
  const approve = trimmed.match(/^approve(?:\s+((?:[QI])-\d{1,6}))?\s*$/i);
  if (approve) return { type: "approve", number: approve[1] ? approve[1].toUpperCase() : null };
  if (/^invoice\b/i.test(trimmed)) return { type: "invoice", raw: trimmed };
  return { type: "job", text: trimmed };
}

export function normaliseWhatsAppNumber(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (/^0\d{10}$/.test(digits)) return `44${digits.slice(1)}`;
  if (/^44\d{9,12}$/.test(digits)) return digits;
  return null;
}
