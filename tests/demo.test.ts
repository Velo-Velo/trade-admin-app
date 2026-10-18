import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  DEMO_BUSINESS_NAME,
  DEMO_CHECKLIST_OVERRIDES,
  DEMO_EMAIL,
  DEMO_ENQUIRIES,
  DEMO_PRICE_BOOK,
  DEMO_TRADER,
  demoChecklistSeed,
  demoModeEnabled,
} from "@/lib/demo";
import { buildDraftQuote } from "@/lib/quotes/draft";
import { PLUMBING_TEMPLATES } from "@/lib/templates/plumbing";

describe("demo mode", () => {
  it("is on only when DEMO_MODE=true", () => {
    const previous = process.env.DEMO_MODE;
    delete process.env.DEMO_MODE;
    expect(demoModeEnabled()).toBe(false);
    process.env.DEMO_MODE = "false";
    expect(demoModeEnabled()).toBe(false);
    process.env.DEMO_MODE = "true";
    expect(demoModeEnabled()).toBe(true);
    if (previous === undefined) delete process.env.DEMO_MODE;
    else process.env.DEMO_MODE = previous;
  });

  it("uses fictional UK-wide sample data, with drafts, a sent quote and an accepted quote", async () => {
    const blob = JSON.stringify({
      DEMO_TRADER,
      DEMO_PRICE_BOOK,
      DEMO_ENQUIRIES,
      DEMO_CHECKLIST_OVERRIDES,
      DEMO_EMAIL,
      DEMO_BUSINESS_NAME,
    });
    expect(blob.toLowerCase()).not.toMatch(/colchester|essex/);
    expect(blob).not.toMatch(/\bCO\d/i);
    expect(DEMO_TRADER.area.toLowerCase()).toContain("uk");
    expect(DEMO_ENQUIRIES).toHaveLength(4);
    expect(DEMO_ENQUIRIES.filter((item) => item.status === "DRAFT").length).toBeGreaterThanOrEqual(2);
    expect(DEMO_ENQUIRIES.some((item) => item.status === "SENT")).toBe(true);
    expect(DEMO_ENQUIRIES.some((item) => item.status === "ACCEPTED")).toBe(true);
    expect(DEMO_PRICE_BOOK.some((item) => item.lastPaidPence !== null)).toBe(true);

    const checklist = demoChecklistSeed();
    expect(checklist.some((item) => item.status === "DONE" && item.showOnWebsite)).toBe(true);
    expect(checklist.some((item) => item.status === "NOT_STARTED" || item.status === "IN_PROGRESS")).toBe(true);

    const priceBook = DEMO_PRICE_BOOK.map((item, index) => ({
      id: `price-${index}`,
      kind: item.kind,
      description: item.description,
      sellPricePence: item.sellPricePence,
      lastPaidPence: item.lastPaidPence,
    }));
    const tap = await buildDraftQuote({
      trade: "PLUMBING_HEATING",
      jobDescription: DEMO_ENQUIRIES[0].jobDescription,
      templates: PLUMBING_TEMPLATES,
      priceBook,
      completer: null,
    });
    expect(tap.templateSlug).toBe("tap-replacement");
    expect(tap.usedLlm).toBe(false);
    expect(tap.usedPriceBook).toBe(true);
    expect(tap.lines.find((line) => line.description === "Replacement tap")?.lastPaidPence).toBe(4100);

    const boiler = await buildDraftQuote({
      trade: "PLUMBING_HEATING",
      jobDescription: DEMO_ENQUIRIES[2].jobDescription,
      templates: PLUMBING_TEMPLATES,
      priceBook,
      completer: null,
    });
    expect(boiler.templateSlug).toBe("boiler-service");
  });
});

describe("UK-wide copy", () => {
  const files = [
    "README.md",
    ".env.example",
    "render.yaml",
    "src/components/onboarding-form.tsx",
    "src/lib/validation.ts",
    "src/app/t/[slug]/page.tsx",
    "src/app/(app)/quotes/new/page.tsx",
    "src/lib/demo.ts",
    "prisma/seed.ts",
    "scripts/demo.ts",
    "scripts/demo-on-start.ts",
    "render.cron.yaml",
    "src/app/page.tsx",
  ];

  it("does not use Colchester, Essex, or CO postcodes as examples", () => {
    for (const file of files) {
      const text = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
      expect(text.toLowerCase(), file).not.toMatch(/colchester|essex/);
      expect(text, file).not.toMatch(/\bCO\d/);
    }
  });
});
