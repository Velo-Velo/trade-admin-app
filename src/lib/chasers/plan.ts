const DAY = 24 * 60 * 60 * 1000;

export type QuoteChaseInput = {
  status: string;
  sentAt: Date | null;
  chaseStage: number;
  lastChasedAt: Date | null;
  chaseDays: number;
  secondNudge: boolean;
};

export function secondNudgeDay(chaseDays: number): number {
  const first = Math.min(Math.max(chaseDays, 1), 60);
  return first < 7 ? 7 : first + 7;
}

/** A sent quote is due a follow-up after the trader's wait, then an optional later nudge. */
export function isQuoteChaseDue(input: QuoteChaseInput, now: Date): boolean {
  if (input.status !== "SENT" || !input.sentAt) return false;
  if (input.chaseStage < 0 || input.chaseStage >= 2) return false;
  if (input.chaseStage === 1 && !input.secondNudge) return false;
  const first = Math.min(Math.max(input.chaseDays, 1), 60);
  const offset = input.chaseStage === 0 ? first : secondNudgeDay(first);
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

export type ServiceDueInput = {
  recurring: boolean;
  serviceDueAt: Date | null;
  serviceChaseStage: number;
  lastServiceChasedAt: Date | null;
  remindWeeks: number;
};

export function isServiceDueSoon(input: Pick<ServiceDueInput, "recurring" | "serviceDueAt">, now: Date, remindWeeks: number): boolean {
  if (!input.recurring || !input.serviceDueAt) return false;
  const weeks = Math.min(Math.max(remindWeeks, 1), 26);
  return input.serviceDueAt.getTime() - now.getTime() <= weeks * 7 * DAY;
}

export function isServiceChaseDue(input: ServiceDueInput, now: Date): boolean {
  if (input.serviceChaseStage >= 1) return false;
  if (input.lastServiceChasedAt && now.getTime() - input.lastServiceChasedAt.getTime() < DAY) return false;
  return isServiceDueSoon(input, now, input.remindWeeks);
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
  const next = new Date(date.getTime());
  const count = Math.min(Math.max(Math.trunc(months), 1), 60);
  next.setUTCMonth(next.getUTCMonth() + count);
  return next;
}

export function parseFollowUpSettings(input: {
  quoteChaseDays: string;
  quoteChaseSecondNudge: boolean;
  serviceRemindWeeks: string;
  autoSendQuoteChasers: boolean;
}):
  | {
      ok: true;
      data: {
        quoteChaseDays: number;
        quoteChaseSecondNudge: boolean;
        serviceRemindWeeks: number;
        autoSendQuoteChasers: boolean;
      };
    }
  | { ok: false; error: string } {
  if (!/^\d+$/.test(input.quoteChaseDays.trim())) {
    return { ok: false, error: "Enter how many days to wait before a quote follow-up, from 1 to 60." };
  }
  const quoteChaseDays = Number(input.quoteChaseDays.trim());
  if (quoteChaseDays < 1 || quoteChaseDays > 60) {
    return { ok: false, error: "Quote follow-ups wait between 1 and 60 days." };
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
      quoteChaseDays,
      quoteChaseSecondNudge: input.quoteChaseSecondNudge,
      serviceRemindWeeks,
      autoSendQuoteChasers: input.autoSendQuoteChasers,
    },
  };
}
