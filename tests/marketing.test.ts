import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FAQ, HERO, PLANS, PRICING_NOTE } from "@/lib/marketing";
import { SITE_THEMES, siteTheme } from "@/lib/site-theme";

const banned = /streamline|effortless|seamless|empower/i;

describe("public marketing copy", () => {
  it("states the three prices in plain language", () => {
    expect(PLANS.map((plan) => plan.price)).toEqual(["£0", "£11.99", "£14.99"]);
    expect(PLANS[1].period).toBe("a month");
    expect(PLANS[2].name).toMatch(/Splitstick/);
    expect(PRICING_NOTE).toMatch(/does not charge/);
    expect(HERO.title).toBe("Send a quote from the van.");
    expect(FAQ.length).toBeGreaterThanOrEqual(4);
  });

  it("avoids vague product language on the public pages", () => {
    const files = [
      "src/lib/marketing.ts",
      "src/app/page.tsx",
      "src/components/phone-preview.tsx",
      "src/components/trader-public.tsx",
      "src/app/legal/privacy/page.tsx",
      "src/app/legal/terms/page.tsx",
      "src/app/legal/cookies/page.tsx",
    ];
    for (const file of files) {
      const text = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
      expect(text, file).not.toMatch(banned);
    }
  });
});

describe("trader site themes", () => {
  it("keeps three themes and falls back to yard", () => {
    expect(SITE_THEMES).toEqual(["yard", "ink", "signal"]);
    expect(siteTheme("ink")).toBe("ink");
    expect(siteTheme("nope")).toBe("yard");
    expect(siteTheme(null)).toBe("yard");
  });
});
