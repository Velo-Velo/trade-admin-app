export function formatGBP(pence: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(pence / 100);
}

export function dateInputValue(date: Date | null | undefined): string {
  if (!date) return "";
  return date.toISOString().slice(0, 10);
}

export function parseDateInput(value: string): Date | null {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return new Date(`${value}T00:00:00.000Z`);
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatQuantity(value: number): string {
  return new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 }).format(value);
}

export function poundsToPence(input: string): number | null {
  const cleaned = input.trim().replace(/£/g, "").replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole, frac = ""] = cleaned.split(".");
  const pence = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
  if (!Number.isSafeInteger(pence)) return null;
  return pence;
}

export function penceToPoundsInput(pence: number): string {
  const pounds = Math.floor(pence / 100);
  const rest = String(pence % 100).padStart(2, "0");
  return `${pounds}.${rest}`;
}

export function parseQuantity(input: string): number | null {
  const cleaned = input.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  if (!(value > 0) || value > 10000) return null;
  return value;
}

export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

export function contactHref(contact: string): string | null {
  const value = contact.trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return `mailto:${value}`;
  const digits = value.replace(/[^\d+]/g, "");
  if (digits.replace(/\D/g, "").length >= 10) return `tel:${digits}`;
  return null;
}

export function customerEmail(contact: string): string | null {
  const value = contact.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return null;
  return value;
}

export function lineTotalPence(quantity: number, unitPricePence: number): number {
  return Math.round(quantity * unitPricePence);
}

export function quoteTotals(
  lines: Array<{ kind: "LABOUR" | "MATERIAL"; quantity: number; unitPricePence: number }>,
  depositPercent: number,
): { labour: number; materials: number; total: number; deposit: number } {
  let labour = 0;
  let materials = 0;
  for (const line of lines) {
    const total = lineTotalPence(line.quantity, line.unitPricePence);
    if (line.kind === "LABOUR") labour += total;
    else materials += total;
  }
  const total = labour + materials;
  const deposit = Math.round((total * depositPercent) / 100);
  return { labour, materials, total, deposit };
}

export function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export function safeNextPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return "/dashboard";
  }
  return value;
}
