import { describe, expect, it } from "vitest";
import { markQuoteLost, canViewQuotePublicly, acceptSentQuote, declineSentQuote } from "../src/lib/quotes/approval";
import {
  addMonths,
  chaseRelease,
  dueAfterJobDate,
  isOnReminderHorizon,
  isQuoteChaseDue,
  isQuoteExpired,
  isServiceChaseDue,
  isServiceDueSoon,
  listUpcomingReminders,
  parseFollowUpSettings,
  parseServiceReminder,
  quoteChaseCopy,
  quoteExpiresAt,
  secondChaseOffset,
  serviceChaseCopy,
  traderChaseNotice,
} from "../src/lib/chasers/plan";

const day = 24 * 60 * 60 * 1000;
const sentAt = new Date("2026-10-01T00:00:00.000Z");

function quote(overrides: Partial<Parameters<typeof isQuoteChaseDue>[0]> = {}) {
  return {
    status: "SENT",
    sentAt,
    expiresAt: null as Date | null,
    chaseStage: 0,
    lastChasedAt: null,
    chaseDays: 3,
    secondChaseDays: 7,
    secondNudge: true,
    chasersEnabled: true,
    chaseEnabled: true,
    ...overrides,
  };
}

describe("quote follow-ups", () => {
  it("chases at 3 days and again at 7, then stops", () => {
    expect(isQuoteChaseDue(quote(), new Date(sentAt.getTime() + 2 * day))).toBe(false);
    expect(isQuoteChaseDue(quote(), new Date(sentAt.getTime() + 3 * day))).toBe(true);
    expect(isQuoteChaseDue(quote({ chaseStage: 1 }), new Date(sentAt.getTime() + 6 * day))).toBe(false);
    expect(isQuoteChaseDue(quote({ chaseStage: 1 }), new Date(sentAt.getTime() + 7 * day))).toBe(true);
    expect(isQuoteChaseDue(quote({ chaseStage: 2 }), new Date(sentAt.getTime() + 30 * day))).toBe(false);
    expect(secondChaseOffset(3, 7)).toBe(7);
  });

  it("uses the days the trader set, and keeps a week gap when the second day is not later", () => {
    expect(isQuoteChaseDue(quote({ chaseDays: 10, secondChaseDays: 17 }), new Date(sentAt.getTime() + 9 * day))).toBe(false);
    expect(isQuoteChaseDue(quote({ chaseDays: 10, secondChaseDays: 17 }), new Date(sentAt.getTime() + 10 * day))).toBe(true);
    expect(isQuoteChaseDue(quote({ chaseStage: 1, chaseDays: 3, secondChaseDays: 10 }), new Date(sentAt.getTime() + 9 * day))).toBe(false);
    expect(isQuoteChaseDue(quote({ chaseStage: 1, chaseDays: 3, secondChaseDays: 10 }), new Date(sentAt.getTime() + 10 * day))).toBe(true);
    expect(secondChaseOffset(10, 17)).toBe(17);
    expect(secondChaseOffset(10, 7)).toBe(17);
    expect(secondChaseOffset(3, 14)).toBe(14);
    expect(isQuoteChaseDue(quote({ chaseStage: 1, secondNudge: false }), new Date(sentAt.getTime() + 8 * day))).toBe(false);
  });

  it("stops once the quote is accepted, declined, lost, expired, or switched off", () => {
    const later = new Date(sentAt.getTime() + 10 * day);
    for (const status of ["DRAFT", "ACCEPTED", "DECLINED", "LOST", "EXPIRED"]) {
      expect(isQuoteChaseDue(quote({ status }), later)).toBe(false);
    }
    const expiresAt = quoteExpiresAt(sentAt, 30);
    expect(expiresAt?.toISOString()).toBe("2026-10-31T00:00:00.000Z");
    expect(isQuoteExpired({ status: "SENT", expiresAt }, new Date(expiresAt!.getTime() - 1))).toBe(false);
    expect(isQuoteExpired({ status: "SENT", expiresAt }, expiresAt!)).toBe(true);
    expect(isQuoteChaseDue(quote({ expiresAt }), new Date(sentAt.getTime() + 3 * day))).toBe(true);
    expect(isQuoteChaseDue(quote({ expiresAt }), expiresAt!)).toBe(false);
    expect(isQuoteChaseDue(quote({ expiresAt: quoteExpiresAt(sentAt, 2) }), new Date(sentAt.getTime() + 3 * day))).toBe(false);
    expect(quoteExpiresAt(sentAt, 0)).toBeNull();
    expect(isQuoteChaseDue(quote({ chasersEnabled: false }), later)).toBe(false);
    expect(isQuoteChaseDue(quote({ chaseEnabled: false }), later)).toBe(false);
    expect(isQuoteChaseDue(quote({ lastChasedAt: new Date(later.getTime() - 60 * 60 * 1000) }), later)).toBe(false);
  });

  it("uses polite wording and keeps the customer link", () => {
    const first = quoteChaseCopy({
      stage: 0,
      businessName: "Sample Harbour Heating",
      number: "Q-0003",
      customerName: "Jordan Sample",
      quoteUrl: "https://example.com/q/token",
    });
    expect(first.subject).toBe("Following up on quote Q-0003");
    expect(first.text).toContain("There is no rush");
    expect(first.text).toContain("https://example.com/q/token");
    expect(first.text.toLowerCase()).not.toMatch(/colchester|essex/);
  });

  it("tells the trader when a note is waiting or has been sent", () => {
    const waiting = traderChaseNotice({
      kind: "QUOTE",
      sent: false,
      who: "Jordan Sample",
      about: "quote Q-0003",
      followUpUrl: "https://example.com/follow-ups",
    });
    expect(waiting.subject).toBe("Follow-up ready: quote Q-0003");
    expect(waiting.text).toContain("has not been sent");
    expect(waiting.text).toContain("https://example.com/follow-ups");
    const sent = traderChaseNotice({
      kind: "SERVICE",
      sent: true,
      who: "Jordan Sample",
      about: "Annual boiler service",
      followUpUrl: "https://example.com/follow-ups",
    });
    expect(sent.subject).toBe("Service reminder sent: Annual boiler service");
    expect(sent.text).toContain("was sent to the customer");
  });

  it("queues a follow-up unless the trader turns auto-send on or taps Send", () => {
    expect(chaseRelease(false, false)).toBe("queue");
    expect(chaseRelease(true, false)).toBe("send");
    expect(chaseRelease(false, true)).toBe("send");
  });

  it("lets the customer open a lost or expired quote, and refuses accept or decline", () => {
    expect(canViewQuotePublicly("LOST")).toBe(true);
    expect(canViewQuotePublicly("EXPIRED")).toBe(true);
    expect(markQuoteLost("SENT")).toBe("LOST");
    expect(() => markQuoteLost("DRAFT")).toThrow(/Only a sent quote/);
    expect(() => markQuoteLost("ACCEPTED")).toThrow(/Only a sent quote/);
    expect(() => acceptSentQuote("LOST")).toThrow(/Only a sent quote/);
    expect(() => acceptSentQuote("EXPIRED")).toThrow(/Only a sent quote/);
    expect(() => declineSentQuote("LOST")).toThrow(/Only a sent quote/);
    expect(() => declineSentQuote("EXPIRED")).toThrow(/Only a sent quote/);
  });
});

describe("service reminders", () => {
  const dueAt = new Date("2026-11-05T00:00:00.000Z");

  it("is due inside the trader's lead time, including overdue work", () => {
    const soon = { recurring: true, serviceDueAt: dueAt };
    expect(isServiceDueSoon(soon, new Date("2026-10-08T00:00:00.000Z"), 4)).toBe(true);
    expect(isServiceDueSoon(soon, new Date("2026-09-01T00:00:00.000Z"), 4)).toBe(false);
    expect(isServiceDueSoon(soon, new Date("2026-11-20T00:00:00.000Z"), 4)).toBe(true);
    expect(isServiceDueSoon({ recurring: false, serviceDueAt: dueAt }, new Date("2026-10-20T00:00:00.000Z"), 4)).toBe(false);
  });

  it("sends one reminder for a due cycle", () => {
    const input = {
      recurring: true,
      serviceDueAt: dueAt,
      serviceChaseStage: 0,
      lastServiceChasedAt: null,
      remindWeeks: 4,
    };
    expect(isServiceChaseDue(input, new Date("2026-10-08T00:00:00.000Z"))).toBe(true);
    expect(isServiceChaseDue({ ...input, serviceChaseStage: 1 }, new Date("2026-10-08T00:00:00.000Z"))).toBe(false);
    expect(isServiceChaseDue({ ...input, recurring: false }, new Date("2026-10-08T00:00:00.000Z"))).toBe(false);
  });

  it("is due 12 months after the job date, inside the lead time", () => {
    const jobDate = new Date("2025-10-28T00:00:00.000Z");
    const next = dueAfterJobDate(jobDate, 12);
    expect(next.toISOString()).toBe("2026-10-28T00:00:00.000Z");
    const cycle = {
      recurring: true,
      serviceDueAt: next,
      serviceChaseStage: 0,
      lastServiceChasedAt: null,
      remindWeeks: 4,
    };
    expect(isServiceChaseDue(cycle, new Date("2026-09-29T00:00:00.000Z"))).toBe(false);
    expect(isServiceChaseDue(cycle, new Date("2026-09-30T00:00:00.000Z"))).toBe(true);
    expect(isServiceChaseDue(cycle, new Date("2026-11-02T00:00:00.000Z"))).toBe(true);
    expect(isServiceChaseDue({ ...cycle, serviceChaseStage: 1 }, new Date("2026-10-01T00:00:00.000Z"))).toBe(false);
  });

  it("lists reminders that are overdue or due within 18 months", () => {
    const now = new Date("2026-10-28T00:00:00.000Z");
    const items = [
      { id: "soon", dueAt: new Date("2026-11-10T00:00:00.000Z") },
      { id: "year", dueAt: dueAfterJobDate(new Date("2025-10-28T00:00:00.000Z"), 12) },
      { id: "late", dueAt: new Date("2026-10-01T00:00:00.000Z") },
      { id: "old", dueAt: new Date("2026-08-01T00:00:00.000Z") },
      { id: "far", dueAt: new Date("2028-06-01T00:00:00.000Z") },
    ];
    expect(isOnReminderHorizon(items[1].dueAt, now, 18)).toBe(true);
    expect(isOnReminderHorizon(items[4].dueAt, now, 18)).toBe(false);
    expect(listUpcomingReminders(items, now).map((item) => item.id)).toEqual(["late", "year", "soon"]);
  });

  it("invites the customer to the enquiry page and does not claim the visit is booked", () => {
    const copy = serviceChaseCopy({
      businessName: "Sample Harbour Heating",
      customerName: "Jordan Sample",
      title: "Annual boiler service",
      dueAt,
      bookingUrl: "https://example.com/t/sample-harbour-heating",
    });
    expect(copy.subject).toBe("Annual boiler service is due soon");
    expect(copy.text).toContain("5 November 2026");
    expect(copy.text).toContain("https://example.com/t/sample-harbour-heating");
    expect(copy.text).toContain("This note does not book the visit.");
  });

  it("moves the next due date forward by the interval, without skipping short months", () => {
    expect(addMonths(new Date("2026-10-18T12:00:00.000Z"), 12).toISOString()).toBe("2027-10-18T12:00:00.000Z");
    expect(addMonths(new Date("2026-01-31T00:00:00.000Z"), 1).toISOString()).toBe("2026-02-28T00:00:00.000Z");
    expect(addMonths(new Date("2024-02-29T00:00:00.000Z"), 12).toISOString()).toBe("2025-02-28T00:00:00.000Z");
    expect(dueAfterJobDate(new Date("2025-03-15T08:00:00.000Z")).toISOString()).toBe("2026-03-15T08:00:00.000Z");
  });

  it("checks a customer reminder before it is saved", () => {
    const parsed = parseServiceReminder({
      title: "  Gas safety check  ",
      intervalMonths: "12",
      dueAt: "2027-03-15",
      enabled: true,
    });
    expect(parsed).toEqual({
      ok: true,
      data: {
        title: "Gas safety check",
        intervalMonths: 12,
        dueAt: new Date("2027-03-15T00:00:00.000Z"),
        enabled: true,
      },
    });
    expect(parseServiceReminder({ title: "A", intervalMonths: "12", dueAt: "2027-03-15", enabled: true }).ok).toBe(false);
    expect(parseServiceReminder({ title: "Boiler service", intervalMonths: "0", dueAt: "2027-03-15", enabled: true }).ok).toBe(false);
    expect(parseServiceReminder({ title: "Boiler service", intervalMonths: "12", dueAt: "15/03/2027", enabled: true }).ok).toBe(false);
  });
});

describe("follow-up settings", () => {
  it("keeps the defaults inside the allowed range", () => {
    const parsed = parseFollowUpSettings({
      quoteChasersEnabled: true,
      quoteChaseDays: "3",
      quoteChaseSecondNudge: true,
      quoteChaseSecondDays: "7",
      quoteValidDays: "30",
      serviceRemindWeeks: "4",
      autoSendQuoteChasers: false,
    });
    expect(parsed).toEqual({
      ok: true,
      data: {
        quoteChasersEnabled: true,
        quoteChaseDays: 3,
        quoteChaseSecondNudge: true,
        quoteChaseSecondDays: 7,
        quoteValidDays: 30,
        serviceRemindWeeks: 4,
        autoSendQuoteChasers: false,
      },
    });
    expect(parseFollowUpSettings({
      quoteChasersEnabled: false,
      quoteChaseDays: "0",
      quoteChaseSecondNudge: true,
      quoteChaseSecondDays: "7",
      quoteValidDays: "30",
      serviceRemindWeeks: "4",
      autoSendQuoteChasers: false,
    }).ok).toBe(false);
    expect(parseFollowUpSettings({
      quoteChasersEnabled: true,
      quoteChaseDays: "3",
      quoteChaseSecondNudge: true,
      quoteChaseSecondDays: "3",
      quoteValidDays: "30",
      serviceRemindWeeks: "4",
      autoSendQuoteChasers: false,
    }).ok).toBe(false);
    expect(parseFollowUpSettings({
      quoteChasersEnabled: true,
      quoteChaseDays: "3",
      quoteChaseSecondNudge: false,
      quoteChaseSecondDays: "7",
      quoteValidDays: "366",
      serviceRemindWeeks: "4",
      autoSendQuoteChasers: true,
    }).ok).toBe(false);
    expect(parseFollowUpSettings({
      quoteChasersEnabled: true,
      quoteChaseDays: "10",
      quoteChaseSecondNudge: false,
      quoteChaseSecondDays: "7",
      quoteValidDays: "0",
      serviceRemindWeeks: "4",
      autoSendQuoteChasers: false,
    }).ok).toBe(true);
  });
});
