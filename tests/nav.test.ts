import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { NAV_SECTIONS, linkIsActive, onNavKey, sectionForPath, visibleSections } from "@/lib/nav";

const sections = visibleSections(false);

describe("app navigation", () => {
  it("groups the pages into four sections, with Diary in Work and CIS records in Money", () => {
    expect(sections.map((section) => section.label)).toEqual(["Work", "Money", "Customers", "Account"]);
    expect(sections[0]?.links.map((link) => link.label)).toEqual([
      "Dashboard",
      "Enquiries",
      "Quotes",
      "Follow-ups",
      "Jobs",
      "Diary",
    ]);
    expect(sections[1]?.links.map((link) => link.label)).toEqual(["Invoices", "Receipts", "Price book", "CIS records"]);
    expect(sections[2]?.links.map((link) => link.label)).toEqual(["Customers", "RAMS", "Checklist"]);
    expect(sections[3]?.links.map((link) => link.label)).toEqual(["Your page", "Plans", "Account"]);
    expect(sections.flatMap((section) => section.links.map((link) => link.href))).toContain("/diary");
    expect(sections.flatMap((section) => section.links.map((link) => link.href))).toContain("/cis");
  });

  it("shows the WhatsApp simulator only on the sample account", () => {
    expect(visibleSections(false).flatMap((section) => section.links.map((link) => link.href))).not.toContain("/whatsapp");
    const sample = visibleSections(true);
    expect(sample.find((section) => section.id === "account")?.links.map((link) => link.label)).toContain("WhatsApp");
  });

  it("marks the section and page for nested routes", () => {
    expect(sectionForPath("/quotes/new", sections)?.id).toBe("work");
    expect(sectionForPath("/diary", sections)?.id).toBe("work");
    expect(sectionForPath("/cis", sections)?.id).toBe("money");
    expect(sectionForPath("/customers/abc", sections)?.id).toBe("customers");
    expect(sectionForPath("/billing", sections)?.id).toBe("account");
    expect(sectionForPath("/t/harbour", sections)).toBeNull();
    expect(linkIsActive("/invoices/i1", "/invoices")).toBe(true);
    expect(linkIsActive("/invoice", "/invoices")).toBe(false);
  });

  it("moves between sections and links from the keyboard, and closes on Escape", () => {
    const sectionIds = sections.map((section) => section.id);
    const opened = onNavKey({
      key: "ArrowDown",
      openId: null,
      focus: { kind: "section", sectionId: "work" },
      sectionIds,
      linkCount: 6,
    });
    expect(opened).toMatchObject({ openId: "work", focus: { kind: "link", sectionId: "work", index: 0 }, handled: true });

    const next = onNavKey({
      key: "ArrowRight",
      openId: "work",
      focus: { kind: "section", sectionId: "work" },
      sectionIds,
      linkCount: 6,
    });
    expect(next.focus).toEqual({ kind: "section", sectionId: "money" });
    expect(next.openId).toBe("money");

    const closed = onNavKey({
      key: "Escape",
      openId: "money",
      focus: { kind: "link", sectionId: "money", index: 1 },
      sectionIds,
      linkCount: 4,
    });
    expect(closed).toMatchObject({ openId: null, focus: { kind: "section", sectionId: "money" }, handled: true });

    const upToButton = onNavKey({
      key: "ArrowUp",
      openId: "customers",
      focus: { kind: "link", sectionId: "customers", index: 0 },
      sectionIds,
      linkCount: 3,
    });
    expect(upToButton.focus).toEqual({ kind: "section", sectionId: "customers" });
    expect(upToButton.openId).toBe("customers");
  });

  it("does not lay the links out in one scrolling row", () => {
    const source = readFileSync(new URL("../src/components/app-nav.tsx", import.meta.url), "utf8");
    expect(source).not.toContain("overflow-x-auto");
    expect(source).toContain("View your page");
    expect(source).toContain("visibleSections");
    expect(NAV_SECTIONS).toHaveLength(4);
  });
});
