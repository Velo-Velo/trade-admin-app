import { describe, expect, it } from "vitest";
import { buildDraftQuote, matchTemplate } from "../src/lib/quotes/draft";
import { PLUMBING_TEMPLATES } from "../src/lib/templates/plumbing";

const templates = PLUMBING_TEMPLATES;

describe("plumbing templates and draft quotes", () => {
  it("ships ten plumbing and heating templates", () => {
    expect(templates).toHaveLength(10);
    expect(new Set(templates.map((template) => template.slug)).size).toBe(10);
    for (const template of templates) {
      expect(template.lines.some((line) => line.kind === "LABOUR")).toBe(true);
      expect(template.lines.some((line) => line.kind === "MATERIAL")).toBe(true);
      expect(template.keywords.length).toBeGreaterThan(0);
    }
  });

  it("matches a dripping tap and not the word tape", () => {
    expect(matchTemplate("The kitchen tap is dripping", templates)?.slug).toBe("tap-replacement");
    expect(matchTemplate("I need some tape for a box", templates)).toBeNull();
  });

  it("prefers a boiler service over a combi swap", () => {
    expect(matchTemplate("Please book an annual boiler service", templates)?.slug).toBe("boiler-service");
    expect(matchTemplate("We need a new combi boiler", templates)?.slug).toBe("combi-boiler-swap");
  });

  it("uses a blank allowance when nothing matches", async () => {
    const draft = await buildDraftQuote({
      trade: "PLUMBING_HEATING",
      jobDescription: "Please look at the garden gate",
      templates,
      priceBook: [],
    });
    expect(draft.templateSlug).toBeNull();
    expect(draft.usedLlm).toBe(false);
    expect(draft.lines.map((line) => line.kind)).toEqual(["LABOUR", "MATERIAL"]);
  });

  it("keeps template prices when the language model changes the quantity", async () => {
    const draft = await buildDraftQuote({
      trade: "PLUMBING_HEATING",
      jobDescription: "Replace the kitchen tap",
      templates,
      priceBook: [],
      completer: async () => ({
        lines: [
          {
            kind: "LABOUR",
            description: "Replace two kitchen taps",
            quantity: 3,
            unit: "hour",
            unitPricePence: 1,
          },
        ],
      }),
    });
    expect(draft.usedLlm).toBe(true);
    expect(draft.lines).toHaveLength(1);
    expect(draft.lines[0]?.quantity).toBe(3);
    expect(draft.lines[0]?.unitPricePence).toBe(5000);
  });

  it("ignores a broken language model response and still returns a draft", async () => {
    const draft = await buildDraftQuote({
      trade: "PLUMBING_HEATING",
      jobDescription: "cistern keeps running",
      templates,
      priceBook: [],
      completer: async () => {
        throw new Error("network down");
      },
    });
    expect(draft.usedLlm).toBe(false);
    expect(draft.templateSlug).toBe("cistern-repair");
  });

  it("prices a matching material from the price book and keeps last paid", async () => {
    const draft = await buildDraftQuote({
      trade: "PLUMBING_HEATING",
      jobDescription: "Replace the kitchen tap",
      templates,
      priceBook: [
        {
          id: "pb1",
          kind: "MATERIAL",
          description: "Kitchen mixer tap",
          sellPricePence: 6400,
          lastPaidPence: 4100,
        },
      ],
    });
    const tap = draft.lines.find((line) => line.kind === "MATERIAL" && line.description.toLowerCase().includes("tap"));
    expect(tap?.unitPricePence).toBe(6400);
    expect(tap?.lastPaidPence).toBe(4100);
    expect(tap?.priceBookItemId).toBe("pb1");
    expect(draft.usedPriceBook).toBe(true);
  });

  it("does not use plumbing templates for an electrical trader", async () => {
    const draft = await buildDraftQuote({
      trade: "ELECTRICAL",
      jobDescription: "Replace the kitchen tap",
      templates,
      priceBook: [],
    });
    expect(draft.templateSlug).toBeNull();
  });
});
