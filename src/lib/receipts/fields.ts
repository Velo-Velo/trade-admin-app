import { parseDateInput, poundsToPence } from "@/lib/format";

export const EXPENSE_CATEGORIES = ["MATERIALS", "FUEL", "TOOLS", "OTHER"] as const;

export type ExpenseCategoryName = (typeof EXPENSE_CATEGORIES)[number];

export const CATEGORY_LABEL: Record<ExpenseCategoryName, string> = {
  MATERIALS: "Materials",
  FUEL: "Fuel",
  TOOLS: "Tools",
  OTHER: "Other",
};

const MAX_TOTAL_PENCE = 50_000_000;

export type ParsedReceipt = {
  supplier: string;
  description: string;
  spentOn: string | null;
  totalPence: number | null;
  vatPence: number | null;
  category: ExpenseCategoryName;
};

function textField(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

function moneyPence(value: unknown, allowZero: boolean): number | null {
  if (typeof value !== "number" || !Number.isInteger(value)) return null;
  if (value > MAX_TOTAL_PENCE) return null;
  if (value < 0) return null;
  if (value === 0 && !allowZero) return null;
  return value;
}

function dateField(value: unknown, now: Date): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  if (parsed.getUTCFullYear() < 1990) return null;
  if (parsed.getTime() > now.getTime() + 36 * 60 * 60 * 1000) return null;
  return value;
}

function categoryField(value: unknown): ExpenseCategoryName {
  if (typeof value !== "string") return "OTHER";
  const upper = value.trim().toUpperCase();
  return EXPENSE_CATEGORIES.includes(upper as ExpenseCategoryName) ? (upper as ExpenseCategoryName) : "OTHER";
}

/** Keeps only figures that are plainly on the receipt. VAT is omitted when it is not printed. */
export function parseExtractedReceipt(raw: unknown, now = new Date()): ParsedReceipt | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  const totalPence = moneyPence(row.totalPence, false);
  let vatPence = moneyPence(row.vatPence, true);
  if (vatPence != null && totalPence != null && vatPence > totalPence) vatPence = null;
  return {
    supplier: textField(row.supplier, 120),
    description: textField(row.description, 400),
    spentOn: dateField(row.spentOn, now),
    totalPence,
    vatPence,
    category: categoryField(row.category),
  };
}

export function receiptHasFigures(parsed: ParsedReceipt): boolean {
  return Boolean(parsed.supplier || parsed.spentOn || parsed.totalPence != null);
}

export type ExpenseEdit = {
  supplier: string;
  description: string;
  spentOn: Date | null;
  totalPence: number | null;
  vatPence: number | null;
  category: ExpenseCategoryName;
  jobId: string | null;
  customerId: string | null;
};

export function parseExpenseEdit(
  input: {
    supplier: string;
    description: string;
    spentOn: string;
    total: string;
    vat: string;
    category: string;
    jobId: string;
    customerId: string;
  },
  mode: "save" | "confirm",
): { ok: true; data: ExpenseEdit } | { ok: false; error: string } {
  const supplier = input.supplier.replace(/\s+/g, " ").trim().slice(0, 120);
  const description = input.description.replace(/\s+/g, " ").trim().slice(0, 400);
  const spentOn = input.spentOn.trim() ? parseDateInput(input.spentOn.trim()) : null;
  if (input.spentOn.trim() && !spentOn) return { ok: false, error: "Enter the date as it appears on the receipt." };
  const totalRaw = input.total.trim();
  const totalPence = totalRaw ? poundsToPence(totalRaw) : null;
  if (totalRaw && totalPence == null) return { ok: false, error: "Enter the total in pounds, such as 18.60." };
  const vatRaw = input.vat.trim();
  const vatPence = vatRaw ? poundsToPence(vatRaw) : null;
  if (vatRaw && vatPence == null) return { ok: false, error: "Enter the VAT amount in pounds, or leave it blank if the receipt does not show VAT." };
  if (vatPence != null && totalPence == null) {
    return { ok: false, error: "Enter the total before the VAT amount." };
  }
  if (vatPence != null && totalPence != null && vatPence > totalPence) {
    return { ok: false, error: "VAT cannot be more than the total on the receipt." };
  }
  const category = categoryField(input.category);
  if (mode === "confirm") {
    if (!supplier) return { ok: false, error: "Enter the supplier before you confirm." };
    if (!spentOn) return { ok: false, error: "Enter the date before you confirm." };
    if (totalPence == null || totalPence <= 0) return { ok: false, error: "Enter the total before you confirm." };
  }
  return {
    ok: true,
    data: {
      supplier,
      description,
      spentOn,
      totalPence,
      vatPence,
      category,
      jobId: input.jobId.trim() || null,
      customerId: input.customerId.trim() || null,
    },
  };
}
