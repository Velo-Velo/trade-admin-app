import { describe, expect, it } from "vitest";
import { badgesForWebsite, checklistForTrade, checklistProgress } from "../src/lib/checklist/catalog";
import { isDueForReminder, reminderCopy } from "../src/lib/checklist/reminders";

describe("checklist", () => {
  it("includes Gas Safe for plumbing and a competent person scheme for electrical", () => {
    const plumbing = checklistForTrade("PLUMBING_HEATING").map((item) => item.key);
    const electrical = checklistForTrade("ELECTRICAL").map((item) => item.key);
    expect(plumbing).toContain("gas-safe");
    expect(plumbing).toContain("hmrc-self-assessment");
    expect(plumbing).not.toContain("competent-person-electrical");
    expect(electrical).toContain("competent-person-electrical");
    expect(electrical).not.toContain("gas-safe");
    expect(checklistForTrade("BUILDING").map((item) => item.key)).toContain("cscs");
  });

  it("shows a badge only when the trader marked it done, with a number, and opted in", () => {
    const badges = badgesForWebsite([
      {
        status: "DONE",
        showOnWebsite: true,
        badgeLabel: "Gas Safe",
        referenceNumber: "  DEMO-0000 ",
        verifyUrl: "https://www.gassaferegister.co.uk/",
        publicRegister: true,
      },
      {
        status: "NOT_STARTED",
        showOnWebsite: true,
        badgeLabel: "Gas Safe",
        referenceNumber: "999",
        verifyUrl: "https://example.com",
        publicRegister: true,
      },
      {
        status: "DONE",
        showOnWebsite: true,
        badgeLabel: "Waste carrier",
        referenceNumber: "   ",
        verifyUrl: "https://www.gov.uk/waste-carrier-or-broker-registration",
        publicRegister: true,
      },
    ]);
    expect(badges).toEqual([
      {
        label: "Gas Safe",
        reference: "DEMO-0000",
        verifyUrl: "https://www.gassaferegister.co.uk/",
        publicRegister: true,
      },
    ]);
  });

  it("counts progress without not-applicable items", () => {
    expect(
      checklistProgress([
        { status: "DONE" },
        { status: "NOT_STARTED" },
        { status: "NOT_APPLICABLE" },
      ]),
    ).toEqual({ done: 1, total: 2, percent: 50 });
  });

  it("reminds inside the window and then waits a week", () => {
    const now = new Date("2026-10-17T08:00:00.000Z");
    const expiresAt = new Date("2026-11-01T00:00:00.000Z");
    expect(
      isDueForReminder({ expiresAt, status: "DONE", reminderDays: 30, lastRemindedAt: null }, now),
    ).toBe(true);
    expect(
      isDueForReminder(
        { expiresAt, status: "DONE", reminderDays: 30, lastRemindedAt: new Date("2026-10-16T08:00:00.000Z") },
        now,
      ),
    ).toBe(false);
    expect(
      isDueForReminder(
        { expiresAt: new Date("2026-12-31T00:00:00.000Z"), status: "DONE", reminderDays: 30, lastRemindedAt: null },
        now,
      ),
    ).toBe(false);
    expect(
      isDueForReminder({ expiresAt, status: "NOT_APPLICABLE", reminderDays: 30, lastRemindedAt: null }, now),
    ).toBe(false);
    const copy = reminderCopy({
      title: "Gas Safe registration",
      expiresAt: new Date("2026-10-01T00:00:00.000Z"),
      officialUrl: "https://www.gov.uk/find-licences/registration-to-carry-out-gas-work",
      checklistUrl: "https://example.com/checklist",
      now,
    });
    expect(copy.subject).toMatch(/^Overdue:/);
    expect(copy.text).toContain("not legal");
  });
});
