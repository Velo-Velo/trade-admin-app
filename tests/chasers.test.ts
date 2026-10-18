import { describe, expect, it } from "vitest";
import { markQuoteLost, canViewQuotePublicly, acceptSentQuote, declineSentQuote } from "../src/lib/quotes/approval";
import {
  addMonths,
  chaseRelease,
  isQuoteChaseDue,
  isServiceChaseDue,
  isServiceDueSoon,
  parseFollowUpSettings,
  quoteChaseCopy,
  secondNudgeDay,
  serviceChaseCopy,
} from "../src/lib/chasers/plan";

const day = 24 * 60 * 60 * 1000;
const sentAt = new Date("2026-10-01T00:00:00.000Z");

function quote(overrides: Partial<Parameters<typeof isQuoteChaseDue>[0]> = {}) {
  return {
    status: "SENT",
    sentAt,
    chaseStage: 0,
    lastChasedAt: null,
    chaseDays: 3,
    secondNudge: true,
    ...overrides,
  };
}

describe("quote follow-ups", () => {
  it("waits until the trader's number of days, then allows one later nudge", () => {
    expect(isQuoteChaseDue(quote(), new Date(sentAt.getTime() + 2 * day))).toBe(false);
    expect(isQuoteChaseDue(quote(), new Date(sentAt.getTime() + 3 * day))).toBe(true);
    expect(isQuoteChaseDue(quote({ chaseDays: 10 }), new Date(sentAt.getTime() + 9 * day))).toBe(false);
    expect(secondNudgeDay(3)).toBe(7);
    expect(secondNudgeDay(10)).toBe(17);
    expect(isQuoteChaseDue(quote({ chaseStage: 1 }), new Date(sentAt.getTime() + 6 * day))).toBe(false);
    expect(isQuoteChaseDue(quote({ chaseStage: 1 }), new Date(sentAt.getTime() + 7 * day))).toBe(true);
    expect(isQuoteChaseDue(quote({ chaseStage: 1, secondNudge: false }), new Date(sentAt.getTime() + 8 * day))).toBe(false);
  });

  it("stops once the quote is accepted, declined, lost, or still a draft", () => {
    const later = new Date(sentAt.getTime() + 10 * day);
    for (const status of ["DRAFT", "ACCEPTED", "DECLINED", "LOST"]) {
      expect(isQuoteChaseDue(quote({ status }), later)).toBe(false);
    }
    expect(isQuoteChaseDue(quote({ chaseStage: 2 }), later)).toBe(false);
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

  it("queues a follow-up unless the trader turns auto-send on or taps Send", () => {
    expect(chaseRelease(false, false)).toBe("queue");
    expect(chaseRelease(true, false)).toBe("send");
    expect(chaseRelease(false, true)).toBe("send");
  });

  it("lets the customer open a lost quote, and refuses accept or decline", () => {
    expect(canViewQuotePublicly("LOST")).toBe(true);
    expect(markQuoteLost("SENT")).toBe("LOST");
    expect(() => markQuoteLost("DRAFT")).toThrow(/Only a sent quote/);
    expect(() => markQuoteLost("ACCEPTED")).toThrow(/Only a sent quote/);
    expect(() => acceptSentQuote("LOST")).toThrow(/Only a sent quote/);
    expect(() => declineSentQuote("LOST")).toThrow(/Only a sent quote/);
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

  it("moves the next due date forward by the interval", () => {
    expect(addMonths(new Date("2026-10-18T12:00:00.000Z"), 12).toISOString()).toBe("2027-10-18T12:00:00.000Z");
  });
});

describe("follow-up settings", () => {
  it("keeps the defaults inside the allowed range", () => {
    const parsed = parseFollowUpSettings({
      quoteChaseDays: "3",
      quoteChaseSecondNudge: true,
      serviceRemindWeeks: "4",
      autoSendQuoteChasers: false,
    });
    expect(parsed).toEqual({
      ok: true,
      data: {
        quoteChaseDays: 3,
        quoteChaseSecondNudge: true,
        serviceRemindWeeks: 4,
        autoSendQuoteChasers: false,
      },
    });
    expect(parseFollowUpSettings({
      quoteChaseDays: "0",
      quoteChaseSecondNudge: true,
      serviceRemindWeeks: "4",
      autoSendQuoteChasers: false,
    }).ok).toBe(false);
    expect(parseFollowUpSettings({
      quoteChaseDays: "3",
      quoteChaseSecondNudge: false,
      serviceRemindWeeks: "27",
      autoSendQuoteChasers: true,
    }).ok).toBe(false);
  });
});
