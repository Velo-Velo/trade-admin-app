import { billingConfigured, featureAllowed, sendBlockReason } from "../billing/plans";
import { prisma } from "../db";
import { sendEmail } from "../email";
import { isSandboxTrader } from "../sandbox";
import {
  chaseRelease,
  isQuoteChaseDue,
  isServiceChaseDue,
  quoteChaseCopy,
  serviceChaseCopy,
  traderChaseNotice,
} from "./plan";
import { deliverCustomerChase } from "./deliver";

function chasersOpen(trader: { slug: string; plan: "FREE" | "TRADE" | "SPLITSTICK"; user: { email: string; emailVerifiedAt: Date | null } }): {
  sandbox: boolean;
  hold: boolean;
} {
  const sandbox = isSandboxTrader({ slug: trader.slug, email: trader.user.email });
  if (!featureAllowed({ plan: trader.plan, feature: "chasers", sandbox, billingOn: billingConfigured() })) {
    return { sandbox, hold: true };
  }
  return { sandbox, hold: Boolean(sendBlockReason({ emailVerifiedAt: trader.user.emailVerifiedAt, sandbox })) };
}

function origin(): string {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

async function rememberQuote(quoteId: string, stage: number, detail: string, sent: boolean, now: Date) {
  await prisma.quote.update({
    where: { id: quoteId },
    data: { chaseStage: stage + 1, lastChasedAt: now },
  });
  await prisma.quoteEvent.create({
    data: { quoteId, type: sent ? "chase_sent" : "chase_queued", channel: "web", detail },
  });
}

type ChaseSlot = { quoteId: string } | { jobId: string } | { serviceReminderId: string };

async function saveChase(
  slot: ChaseSlot,
  data: {
    traderId: string;
    kind: "QUOTE" | "SERVICE";
    stage: number;
    subject: string;
    body: string;
    status: "PENDING" | "SENT";
    sentAt: Date | null;
  },
): Promise<"saved" | "already"> {
  const where =
    "quoteId" in slot
      ? { quoteId: slot.quoteId, stage: data.stage }
      : "jobId" in slot
        ? { jobId: slot.jobId, stage: data.stage }
        : { serviceReminderId: slot.serviceReminderId, stage: data.stage };
  const existing = await prisma.customerChase.findFirst({ where });
  if (existing && (existing.status === "PENDING" || existing.status === "SENT")) return "already";
  const payload = {
    status: data.status,
    subject: data.subject,
    body: data.body,
    sentAt: data.sentAt,
  };
  if (existing) {
    await prisma.customerChase.update({ where: { id: existing.id }, data: payload });
    return "saved";
  }
  await prisma.customerChase.create({
    data: {
      traderId: data.traderId,
      kind: data.kind,
      stage: data.stage,
      ...slot,
      ...payload,
    },
  });
  return "saved";
}

async function notifyTrader(input: {
  email: string;
  sandbox: boolean;
  sent: boolean;
  kind: "QUOTE" | "SERVICE";
  who: string;
  about: string;
  followUpUrl: string;
}) {
  const copy = traderChaseNotice(input);
  try {
    await sendEmail({ to: input.email, subject: copy.subject, text: copy.text, sandbox: input.sandbox });
  } catch (error) {
    console.error("[chase trader]", error);
  }
}

export async function expireQuoteNow(quoteId: string, now: Date): Promise<boolean> {
  const updated = await prisma.quote.updateMany({
    where: { id: quoteId, status: "SENT", expiresAt: { lte: now } },
    data: { status: "EXPIRED", expiredAt: now },
  });
  if (updated.count === 0) return false;
  await stopQuoteChases(quoteId, "Quote expired. Follow-ups stopped. The customer was not emailed.");
  return true;
}

export async function expireOpenQuotes(now: Date): Promise<number> {
  const due = await prisma.quote.findMany({
    where: { status: "SENT", expiresAt: { lte: now } },
    select: { id: true },
  });
  let count = 0;
  for (const quote of due) {
    if (await expireQuoteNow(quote.id, now)) count += 1;
  }
  return count;
}

export async function queueCustomerChases(now = new Date()): Promise<{
  quotesExpired: number;
  quotesQueued: number;
  quotesSent: number;
  servicesQueued: number;
  servicesSent: number;
}> {
  const appUrl = origin();
  const followUpUrl = `${appUrl}/follow-ups`;
  const quotesExpired = await expireOpenQuotes(now);
  let quotesQueued = 0;
  let quotesSent = 0;
  let servicesQueued = 0;
  let servicesSent = 0;

  const quotes = await prisma.quote.findMany({
    where: { status: "SENT", lostAt: null, chaseEnabled: true, trader: { quoteChasersEnabled: true } },
    include: { trader: { include: { user: true } }, customer: true },
  });
  for (const quote of quotes) {
    const due = isQuoteChaseDue(
      {
        status: quote.status,
        sentAt: quote.sentAt,
        expiresAt: quote.expiresAt,
        chaseStage: quote.chaseStage,
        lastChasedAt: quote.lastChasedAt,
        chaseDays: quote.trader.quoteChaseDays,
        secondChaseDays: quote.trader.quoteChaseSecondDays,
        secondNudge: quote.trader.quoteChaseSecondNudge,
        chasersEnabled: quote.trader.quoteChasersEnabled,
        chaseEnabled: quote.chaseEnabled,
      },
      now,
    );
    if (!due) continue;
    const access = chasersOpen(quote.trader);
    if (!featureAllowed({ plan: quote.trader.plan, feature: "chasers", sandbox: access.sandbox, billingOn: billingConfigured() })) {
      continue;
    }
    const copy = quoteChaseCopy({
      stage: quote.chaseStage,
      businessName: quote.trader.businessName,
      number: quote.number,
      customerName: quote.customerName,
      quoteUrl: `${appUrl}/q/${quote.publicToken}`,
    });
    const release = access.hold ? "queue" : chaseRelease(quote.trader.autoSendQuoteChasers, false);
    let sentOk = false;
    let detail = "Follow-up is waiting for you to send. The customer has not been emailed.";
    if (release === "send") {
      const sent = await deliverCustomerChase({
        traderId: quote.traderId,
        traderWhatsapp: quote.trader.whatsappE164,
        contact: quote.customerContact,
        customerPhone: quote.customer?.phone ?? "",
        customerEmail: quote.customer?.email ?? "",
        subject: copy.subject,
        text: copy.text,
        sandbox: access.sandbox,
      });
      sentOk = sent.ok;
      detail = sent.detail;
    }
    const saved = await saveChase(
      { quoteId: quote.id },
      {
        traderId: quote.traderId,
        kind: "QUOTE",
        stage: quote.chaseStage,
        subject: copy.subject,
        body: copy.text,
        status: sentOk ? "SENT" : "PENDING",
        sentAt: sentOk ? now : null,
      },
    );
    if (saved === "already") continue;
    if (sentOk) {
      await rememberQuote(quote.id, quote.chaseStage, detail, true, now);
      quotesSent += 1;
    } else {
      quotesQueued += 1;
    }
    await notifyTrader({
      email: quote.trader.user.email,
      sandbox: access.sandbox,
      sent: sentOk,
      kind: "QUOTE",
      who: quote.customerName,
      about: `quote ${quote.number}`,
      followUpUrl,
    });
  }

  const jobs = await prisma.job.findMany({
    where: { recurring: true, serviceDueAt: { not: null }, serviceChaseStage: 0 },
    include: { trader: { include: { user: true } }, customer: true },
  });
  for (const job of jobs) {
    if (!job.serviceDueAt) continue;
    const outcome = await releaseService({
      now,
      appUrl,
      followUpUrl,
      trader: job.trader,
      stage: job.serviceChaseStage,
      lastChasedAt: job.lastServiceChasedAt,
      dueAt: job.serviceDueAt,
      title: job.title,
      customerName: job.customer.name,
      contact: job.customer.email || job.customer.phone,
      customerPhone: job.customer.phone,
      customerEmail: job.customer.email,
      slot: { jobId: job.id },
    });
    if (outcome === "sent") {
      await prisma.job.update({
        where: { id: job.id },
        data: { serviceChaseStage: 1, lastServiceChasedAt: now },
      });
      servicesSent += 1;
    } else if (outcome === "queued") {
      servicesQueued += 1;
    }
  }

  const reminders = await prisma.serviceReminder.findMany({
    where: { enabled: true, chaseStage: 0 },
    include: { trader: { include: { user: true } }, customer: true },
  });
  for (const reminder of reminders) {
    const outcome = await releaseService({
      now,
      appUrl,
      followUpUrl,
      trader: reminder.trader,
      stage: reminder.chaseStage,
      lastChasedAt: reminder.lastChasedAt,
      dueAt: reminder.dueAt,
      title: reminder.title,
      customerName: reminder.customer.name,
      contact: reminder.customer.email || reminder.customer.phone,
      customerPhone: reminder.customer.phone,
      customerEmail: reminder.customer.email,
      slot: { serviceReminderId: reminder.id },
    });
    if (outcome === "sent") {
      await prisma.serviceReminder.update({
        where: { id: reminder.id },
        data: { chaseStage: 1, lastChasedAt: now },
      });
      servicesSent += 1;
    } else if (outcome === "queued") {
      servicesQueued += 1;
    }
  }

  return { quotesExpired, quotesQueued, quotesSent, servicesQueued, servicesSent };
}

async function releaseService(input: {
  now: Date;
  appUrl: string;
  followUpUrl: string;
  trader: {
    id: string;
    slug: string;
    plan: "FREE" | "TRADE" | "SPLITSTICK";
    businessName: string;
    whatsappE164: string | null;
    autoSendQuoteChasers: boolean;
    serviceRemindWeeks: number;
    user: { email: string; emailVerifiedAt: Date | null };
  };
  stage: number;
  lastChasedAt: Date | null;
  dueAt: Date;
  title: string;
  customerName: string;
  contact: string;
  customerPhone: string;
  customerEmail: string;
  slot: { jobId: string } | { serviceReminderId: string };
}): Promise<"sent" | "queued" | "skip"> {
  const due = isServiceChaseDue(
    {
      recurring: true,
      serviceDueAt: input.dueAt,
      serviceChaseStage: input.stage,
      lastServiceChasedAt: input.lastChasedAt,
      remindWeeks: input.trader.serviceRemindWeeks,
    },
    input.now,
  );
  if (!due) return "skip";
  const access = chasersOpen(input.trader);
  if (!featureAllowed({ plan: input.trader.plan, feature: "chasers", sandbox: access.sandbox, billingOn: billingConfigured() })) {
    return "skip";
  }
  const copy = serviceChaseCopy({
    businessName: input.trader.businessName,
    customerName: input.customerName,
    title: input.title,
    dueAt: input.dueAt,
    bookingUrl: `${input.appUrl}/t/${input.trader.slug}`,
  });
  const release = access.hold ? "queue" : chaseRelease(input.trader.autoSendQuoteChasers, false);
  let sentOk = false;
  if (release === "send") {
    const sent = await deliverCustomerChase({
      traderId: input.trader.id,
      traderWhatsapp: input.trader.whatsappE164,
      contact: input.contact,
      customerPhone: input.customerPhone,
      customerEmail: input.customerEmail,
      subject: copy.subject,
      text: copy.text,
      sandbox: access.sandbox,
    });
    sentOk = sent.ok;
  }
  const saved = await saveChase(input.slot, {
    traderId: input.trader.id,
    kind: "SERVICE",
    stage: input.stage,
    subject: copy.subject,
    body: copy.text,
    status: sentOk ? "SENT" : "PENDING",
    sentAt: sentOk ? input.now : null,
  });
  if (saved === "already") return "skip";
  await notifyTrader({
    email: input.trader.user.email,
    sandbox: access.sandbox,
    sent: sentOk,
    kind: "SERVICE",
    who: input.customerName,
    about: input.title,
    followUpUrl: input.followUpUrl,
  });
  return sentOk ? "sent" : "queued";
}

export async function stopQuoteChases(quoteId: string, detail: string): Promise<void> {
  await prisma.customerChase.updateMany({
    where: { quoteId, status: "PENDING" },
    data: { status: "DISMISSED" },
  });
  await prisma.quoteEvent.create({
    data: { quoteId, type: "chase_stopped", channel: "web", detail },
  });
}
