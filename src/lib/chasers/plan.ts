import { parseDateInput } from "../format";

const DAY = 24 * 60 * 60 * 1000;

export const DEFAULT_QUOTE_CHASE_DAYS = 3;
export const DEFAULT_QUOTE_SECOND_CHASE_DAYS = 7;
export const DEFAULT_QUOTE_VALID_DAYS = 30;
export const DEFAULT_SERVICE_INTERVAL_MONTHS = 12;
export const DEFAULT_SERVICE_REMIND_WEEKS = 4;

function clampInt(value: number, min: number, max: number): number {
  return Math.min(Math.max(Math.trunc(value), min), max);
}

export type QuoteChaseInput = {
  status: string;
  sentAt: Date | null;
  expiresAt: Date | null;
  chaseStage: number;
  lastChasedAt: Date | null;
  chaseDays: number;
  secondChaseDays: number;
  secondNudge: boolean;
  chasersEnabled: boolean;
  chaseEnabled: boolean;
};

/**
 * Day the second note goes out, counted from the day the quote was sent.
 * When the saved second day is not later than the first, keep a week between them.
 */
export function secondChaseOffset(firstDays: number, secondDays: number): number {
  const first = clampInt(firstDays, 1, 60);
  const second = clampInt(secondDays, 1, 90);
  if (second > first) return second;
  return Math.min(first + 7, 90);
}

export function quoteExpiresAt(sentAt: Date, validDays: number): Date | null {
  const days = Math.trunc(validDays);
  if (days <= 0) return null;
  return new Date(sentAt.getTime() + clampInt(days, 1, 365) * DAY);
}

export function isQuoteExpired(input: { status: string; expiresAt: Date | null }, now: Date): boolean {
  if (input.status === "EXPIRED") return true;
  if (input.status !== "SENT" || !input.expiresAt) return false;
  return now.getTime() >= input.expiresAt.getTime();
}

/** A sent quote is due a follow-up after the trader's wait, then an optional later nudge. */
export function isQuoteChaseDue(input: QuoteChaseInput, now: Date): boolean {
  if (!input.chasersEnabled || !input.chaseEnabled) return false;
  if (input.status !== "SENT" || !input.sentAt) return false;
  if (isQuoteExpired(input, now)) return false;
  if (input.chaseStage < 0 || input.chaseStage >= 2) return false;
  if (input.chaseStage === 1 && !input.secondNudge) return false;
  const first = clampInt(input.chaseDays, 1, 60);
  const offset = input.chaseStage === 0 ? first : secondChaseOffset(first, input.secondChaseDays);
  if (now.getTime() < input.sentAt.getTime() + offset * DAY) return false;
  if (input.lastChasedAt && now.getTime() - input.lastChasedAt.getTime() < DAY) return false;
  return true;
}

export function quoteChaseCopy(input: {
  stage: number;
  businessName: string;
  number: string;
  customerName: string;
  quoteUrl: string;
}): { subject: string; text: string } {
  const hello = `Hello ${input.customerName},`;
  if (input.stage <= 0) {
    return {
      subject: `Following up on quote ${input.number}`,
      text: [
        hello,
        "",
        `You have a quote from ${input.businessName} (${input.number}) that we sent a few days ago.`,
        "There is no rush. Let us know if you would like to go ahead, or if you have a question.",
        "",
        `View the quote: ${input.quoteUrl}`,
        "",
        "Thank you.",
      ].join("\n"),
    };
  }
  return {
    subject: `A reminder about quote ${input.number}`,
    text: [
      hello,
      "",
      `This is a gentle reminder about quote ${input.number} from ${input.businessName}.`,
      "If you would like the work done, you can accept it on the link. If you have decided not to go ahead, you can decline it there too.",
      "",
      `View the quote: ${input.quoteUrl}`,
    ].join("\n"),
  };
}

export function traderChaseNotice(input: {
  kind: "QUOTE" | "SERVICE";
  sent: boolean;
  who: string;
  about: string;
  followUpUrl: string;
}): { subject: string; text: string } {
  const label = input.kind === "QUOTE" ? "Follow-up" : "Service reminder";
  const subject = input.sent ? `${label} sent: ${input.about}` : `${label} ready: ${input.about}`;
  const line = input.sent
    ? `${label} for ${input.who} (${input.about}) was sent to the customer.`
    : `${label} for ${input.who} (${input.about}) is waiting in Follow-ups. It has not been sent to the customer.`;
  return {
    subject,
    text: [line, "", input.followUpUrl].join("\n"),
  };
}

export type ServiceDueInput = {
  recurring: boolean;
  serviceDueAt: Date | null;
  serviceChaseStage: number;
  lastServiceChasedAt: Date | null;
  remindWeeks: number;
};

export function isServiceDueSoon(input: Pick<ServiceDueInput, "recurring" | "serviceDueAt">, now: Date, remindWeeks: number): boolean {
  if (!input.recurring || !input.serviceDueAt) return false;
  const weeks = clampInt(remindWeeks, 1, 26);
  return input.serviceDueAt.getTime() - now.getTime() <= weeks * 7 * DAY;
}

export function isServiceChaseDue(input: ServiceDueInput, now: Date): boolean {
  if (input.serviceChaseStage >= 1) return false;
  if (input.lastServiceChasedAt && now.getTime() - input.lastServiceChasedAt.getTime() < DAY) return false;
  return isServiceDueSoon(input, now, input.remindWeeks);
}

/** Include overdue reminders from the last 60 days and ones due inside the horizon. */
export function isOnReminderHorizon(dueAt: Date, now: Date, horizonMonths = 18): boolean {
  const months = clampInt(horizonMonths, 1, 36);
  const start = now.getTime() - 60 * DAY;
  const end = addMonths(now, months).getTime();
  const at = dueAt.getTime();
  return at >= start && at <= end;
}

export function listUpcomingReminders<T extends { dueAt: Date }>(items: T[], now: Date, horizonMonths = 18): T[] {
  return items
    .filter((item) => isOnReminderHorizon(item.dueAt, now, horizonMonths))
    .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
}

export function serviceChaseCopy(input: {
  businessName: string;
  customerName: string;
  title: string;
  dueAt: Date;
  bookingUrl: string;
}): { subject: string; text: string } {
  const due = input.dueAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  return {
    subject: `${input.title} is due soon`,
    text: [
      `Hello ${input.customerName},`,
      "",
      `Your ${input.title.toLowerCase()} with ${input.businessName} is due around ${due}.`,
      "If you would like us to book it in, send an enquiry from the page below and we will come back to you with a time.",
      "",
      `Book here: ${input.bookingUrl}`,
      "",
      "This note does not book the visit.",
    ].join("\n"),
  };
}

/** Nothing is delivered until the trader sends it, unless they have turned auto-send on. */
export function chaseRelease(autoSend: boolean, traderApproved: boolean): "send" | "queue" {
  if (traderApproved || autoSend) return "send";
  return "queue";
}

export function addMonths(date: Date, months: number): Date {
  const count = clampInt(months, 1, 60);
  const next = new Date(date.getTime());
  const day = next.getUTCDate();
  next.setUTCDate(1);
  next.setUTCMonth(next.getUTCMonth() + count);
  const last = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
  next.setUTCDate(Math.min(day, last));
  return next;
}

/** The next visit is this many months after the job date. 12 months is the usual gap. */
export function dueAfterJobDate(jobDate: Date, months = DEFAULT_SERVICE_INTERVAL_MONTHS): Date {
  return addMonths(jobDate, months);
}

export function parseFollowUpSettings(input: {
  quoteChasersEnabled: boolean;
  quoteChaseDays: string;
  quoteChaseSecondNudge: boolean;
  quoteChaseSecondDays: string;
  quoteValidDays: string;
  serviceRemindWeeks: string;
  autoSendQuoteChasers: boolean;
}):
  | {
      ok: true;
      data: {
        quoteChasersEnabled: boolean;
        quoteChaseDays: number;
        quoteChaseSecondNudge: boolean;
        quoteChaseSecondDays: number;
        quoteValidDays: number;
        serviceRemindWeeks: number;
        autoSendQuoteChasers: boolean;
      };
    }
  | { ok: false; error: string } {
  if (!/^\d+$/.test(input.quoteChaseDays.trim())) {
    return { ok: false, error: "Enter how many days to wait before the first quote follow-up, from 1 to 60." };
  }
  const quoteChaseDays = Number(input.quoteChaseDays.trim());
  if (quoteChaseDays < 1 || quoteChaseDays > 60) {
    return { ok: false, error: "The first quote follow-up waits between 1 and 60 days." };
  }
  if (!/^\d+$/.test(input.quoteChaseSecondDays.trim())) {
    return { ok: false, error: "Enter how many days to wait before the second quote follow-up, from 1 to 90." };
  }
  const quoteChaseSecondDays = Number(input.quoteChaseSecondDays.trim());
  if (quoteChaseSecondDays < 1 || quoteChaseSecondDays > 90) {
    return { ok: false, error: "The second quote follow-up waits between 1 and 90 days." };
  }
  if (input.quoteChaseSecondNudge && quoteChaseSecondDays <= quoteChaseDays) {
    return { ok: false, error: "The second follow-up has to be later than the first." };
  }
  if (!/^\d+$/.test(input.quoteValidDays.trim())) {
    return { ok: false, error: "Enter how many days a quote stays open, from 0 to 365. Use 0 if it should not expire." };
  }
  const quoteValidDays = Number(input.quoteValidDays.trim());
  if (quoteValidDays < 0 || quoteValidDays > 365) {
    return { ok: false, error: "A quote can stay open for 0 to 365 days. Use 0 if it should not expire." };
  }
  if (!/^\d+$/.test(input.serviceRemindWeeks.trim())) {
    return { ok: false, error: "Enter how many weeks before a service to remind the customer, from 1 to 26." };
  }
  const serviceRemindWeeks = Number(input.serviceRemindWeeks.trim());
  if (serviceRemindWeeks < 1 || serviceRemindWeeks > 26) {
    return { ok: false, error: "Service reminders are sent between 1 and 26 weeks before the due date." };
  }
  return {
    ok: true,
    data: {
      quoteChasersEnabled: input.quoteChasersEnabled,
      quoteChaseDays,
      quoteChaseSecondNudge: input.quoteChaseSecondNudge,
      quoteChaseSecondDays,
      quoteValidDays,
      serviceRemindWeeks,
      autoSendQuoteChasers: input.autoSendQuoteChasers,
    },
  };
}

export function parseServiceReminder(input: {
  title: string;
  intervalMonths: string;
  dueAt: string;
  enabled: boolean;
}):
  | { ok: true; data: { title: string; intervalMonths: number; dueAt: Date; enabled: boolean } }
  | { ok: false; error: string } {
  const title = input.title.trim().replace(/\s+/g, " ");
  if (title.length < 2 || title.length > 80) {
    return { ok: false, error: "Name the reminder in a few words, such as boiler service or gas safety check." };
  }
  if (!/^\d+$/.test(input.intervalMonths.trim())) {
    return { ok: false, error: "Enter how many months between visits, from 1 to 60." };
  }
  const intervalMonths = Number(input.intervalMonths.trim());
  if (intervalMonths < 1 || intervalMonths > 60) {
    return { ok: false, error: "Reminders repeat every 1 to 60 months." };
  }
  const dueAt = parseDateInput(input.dueAt.trim());
  if (!dueAt) return { ok: false, error: "Enter the due date as a calendar date." };
  return { ok: true, data: { title, intervalMonths, dueAt, enabled: input.enabled } };
}
