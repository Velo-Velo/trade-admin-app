import type { TradeValue } from "@/lib/trades";

export type LineKind = "LABOUR" | "MATERIAL";

export type DraftLine = {
  kind: LineKind;
  description: string;
  quantity: number;
  unit: string;
  unitPricePence: number;
  priceBookItemId?: string | null;
  lastPaidPence?: number | null;
};

export type TemplateInput = {
  trade: TradeValue;
  slug: string;
  name: string;
  keywords: string[];
  lines: DraftLine[];
};

export type PriceBookMatch = {
  id: string;
  kind: LineKind;
  description: string;
  sellPricePence: number;
  lastPaidPence?: number | null;
};

export type LlmCompleter = (payload: {
  jobDescription: string;
  templateName: string | null;
  lines: DraftLine[];
}) => Promise<unknown>;

export type DraftResult = {
  lines: DraftLine[];
  templateName: string | null;
  templateSlug: string | null;
  usedLlm: boolean;
  usedPriceBook: boolean;
};

const STOP_WORDS = new Set(["the", "and", "for", "with", "job", "set", "item", "new", "replace", "replacement"]);

export function fallbackLines(): DraftLine[] {
  return [
    {
      kind: "LABOUR",
      description: "Labour to carry out the work described",
      quantity: 2,
      unit: "hour",
      unitPricePence: 5000,
    },
    {
      kind: "MATERIAL",
      description: "Materials allowance — confirm before sending",
      quantity: 1,
      unit: "allowance",
      unitPricePence: 0,
    },
  ];
}

export function templatesForTrade<T extends { trade: string }>(trade: TradeValue, templates: T[]): T[] {
  if (trade === "GENERAL") return templates;
  return templates.filter((template) => template.trade === trade);
}

function includesKeyword(text: string, keyword: string): boolean {
  const escaped = keyword
    .trim()
    .toLowerCase()
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\s+/g, "\\s+");
  if (!escaped) return false;
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, "i").test(text);
}

export function matchTemplate<T extends { keywords: string[]; slug: string }>(
  description: string,
  templates: T[],
): T | null {
  const text = description.toLowerCase();
  let best: { template: T; score: number } | null = null;
  for (const template of templates) {
    let score = 0;
    for (const keyword of template.keywords) {
      if (includesKeyword(text, keyword)) score += keyword.trim().length;
    }
    if (score > 0 && (!best || score > best.score)) {
      best = { template, score };
    }
  }
  return best?.template ?? null;
}

function tokens(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word));
}

export function matchPriceBook(description: string, kind: LineKind, items: PriceBookMatch[]): PriceBookMatch | null {
  const wanted = tokens(description);
  if (wanted.length === 0) return null;
  let best: { item: PriceBookMatch; score: number } | null = null;
  for (const item of items) {
    if (item.kind !== kind) continue;
    const have = new Set(tokens(item.description));
    let score = 0;
    for (const word of wanted) {
      if (have.has(word)) score += 1;
    }
    const overlap = score / wanted.length;
    if (overlap >= 0.5 && score >= 1 && (!best || score > best.score)) {
      best = { item, score };
    }
  }
  return best?.item ?? null;
}

function cloneLines(lines: DraftLine[]): DraftLine[] {
  return lines.map((line) => ({ ...line }));
}

function mergeLlmLines(original: DraftLine[], raw: unknown): DraftLine[] | null {
  if (!raw || typeof raw !== "object" || !("lines" in raw) || !Array.isArray(raw.lines)) return null;
  if (raw.lines.length === 0 || raw.lines.length > 40) return null;
  const merged: DraftLine[] = [];
  for (let index = 0; index < raw.lines.length; index += 1) {
    const line = raw.lines[index];
    if (!line || typeof line !== "object") return null;
    const kind = "kind" in line ? line.kind : null;
    const description = "description" in line ? line.description : null;
    const quantity = "quantity" in line ? line.quantity : null;
    const unit = "unit" in line ? line.unit : null;
    if (kind !== "LABOUR" && kind !== "MATERIAL") return null;
    if (typeof description !== "string" || description.trim().length < 2) return null;
    if (typeof quantity !== "number" || !(quantity > 0) || quantity > 10000) return null;
    if (typeof unit !== "string" || unit.trim().length < 1 || unit.trim().length > 24) return null;
    const previous = original[index];
    const keepPrice = previous && previous.kind === kind ? previous.unitPricePence : previous?.unitPricePence;
    const modelPrice = "unitPricePence" in line ? line.unitPricePence : undefined;
    const unitPricePence =
      typeof keepPrice === "number"
        ? keepPrice
        : typeof modelPrice === "number" && Number.isInteger(modelPrice) && modelPrice >= 0
          ? modelPrice
          : 0;
    merged.push({
      kind,
      description: description.trim(),
      quantity,
      unit: unit.trim(),
      unitPricePence,
    });
  }
  return merged;
}

export function applyPriceBook(lines: DraftLine[], priceBook: PriceBookMatch[]): { lines: DraftLine[]; used: boolean } {
  let used = false;
  const next = lines.map((line) => {
    const match = matchPriceBook(line.description, line.kind, priceBook);
    if (!match) return line;
    used = true;
    return {
      ...line,
      unitPricePence: match.sellPricePence,
      priceBookItemId: match.id,
      lastPaidPence: match.lastPaidPence ?? null,
    };
  });
  return { lines: next, used };
}

export async function buildDraftQuote(input: {
  trade: TradeValue;
  jobDescription: string;
  templates: TemplateInput[];
  priceBook: PriceBookMatch[];
  completer?: LlmCompleter | null;
}): Promise<DraftResult> {
  const pool = templatesForTrade(input.trade, input.templates);
  const matched = matchTemplate(input.jobDescription, pool);
  let lines = matched ? cloneLines(matched.lines) : fallbackLines();
  let usedLlm = false;
  if (input.completer) {
    try {
      const raw = await input.completer({
        jobDescription: input.jobDescription,
        templateName: matched?.name ?? null,
        lines,
      });
      const merged = mergeLlmLines(lines, raw);
      if (merged) {
        lines = merged;
        usedLlm = true;
      }
    } catch (error) {
      console.warn("[quote draft] language model skipped", error);
    }
  }
  const priced = applyPriceBook(lines, input.priceBook);
  return {
    lines: priced.lines,
    templateName: matched?.name ?? null,
    templateSlug: matched?.slug ?? null,
    usedLlm,
    usedPriceBook: priced.used,
  };
}

export function describeDraft(result: Pick<DraftResult, "templateName" | "usedLlm" | "usedPriceBook">): string {
  const origin = result.templateName
    ? `Started from the "${result.templateName}" template.`
    : "No template matched. Started from a blank labour and materials allowance.";
  const prices = result.usedPriceBook
    ? "At least one line used your price book."
    : "No price book match, so figures are starter prices for you to edit.";
  const llm = result.usedLlm
    ? "A language model adjusted the descriptions and quantities. Check every line."
    : "No language model was used.";
  return `${origin} ${prices} ${llm}`;
}
