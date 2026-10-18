import { billingConfigured, featureAllowed, sendBlockReason } from "../billing/plans";
import { prisma } from "../db";
import { isSandboxTrader } from "../sandbox";
import { chaseRelease, isQuoteChaseDue, isServiceChaseDue, quoteChaseCopy, serviceChaseCopy } from "./plan";
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

export async function queueCustomerChases(now = new Date()): Promise<{
  quotesQueued: number;
  quotesSent: number;
  servicesQueued: number;
  servicesSent: number;
}> {
  const appUrl = origin();
  let quotesQueued = 0;
  let quotesSent = 0;
  let servicesQueued = 0;
  let servicesSent = 0;

  const quotes = await prisma.quote.findMany({
    where: { status: "SENT", lostAt: null },
    include: { trader: { include: { user: true } }, customer: true },
  });
  for (const quote of quotes) {
    const due = isQuoteChaseDue(
      {
        status: quote.status,
        sentAt: quote.sentAt,
        chaseStage: quote.chaseStage,
        lastChasedAt: quote.lastChasedAt,
        chaseDays: quote.trader.quoteChaseDays,
        secondNudge: quote.trader.quoteChaseSecondNudge,
      },
      now,
    );
    if (!due) continue;
    const access = chasersOpen(quote.trader);
    if (!featureAllowed({ plan: quote.trader.plan, feature: "chasers", sandbox: access.sandbox, billingOn: billingConfigured() })) {
      continue;
    }
    const existing = await prisma.customerChase.findFirst({
      where: { quoteId: quote.id, stage: quote.chaseStage, status: { in: ["PENDING", "SENT"] } },
    });
    if (existing) continue;
    const copy = quoteChaseCopy({
      stage: quote.chaseStage,
      businessName: quote.trader.businessName,
      number: quote.number,
      customerName: quote.customerName,
      quoteUrl: `${appUrl}/q/${quote.publicToken}`,
    });
    const release = access.hold ? "queue" : chaseRelease(quote.trader.autoSendQuoteChasers, false);
    if (release === "queue") {
      await prisma.customerChase.create({
        data: {
          traderId: quote.traderId,
          kind: "QUOTE",
          status: "PENDING",
          quoteId: quote.id,
          stage: quote.chaseStage,
          subject: copy.subject,
          body: copy.text,
        },
      });
      quotesQueued += 1;
      continue;
    }
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
    await prisma.customerChase.create({
      data: {
        traderId: quote.traderId,
        kind: "QUOTE",
        status: sent.ok ? "SENT" : "PENDING",
        quoteId: quote.id,
        stage: quote.chaseStage,
        subject: copy.subject,
        body: copy.text,
        sentAt: sent.ok ? now : null,
      },
    });
    if (sent.ok) {
      await rememberQuote(quote.id, quote.chaseStage, sent.detail, true, now);
      quotesSent += 1;
    } else {
      quotesQueued += 1;
    }
  }

  const jobs = await prisma.job.findMany({
    where: { recurring: true, serviceDueAt: { not: null }, serviceChaseStage: 0 },
    include: { trader: { include: { user: true } }, customer: true },
  });
  for (const job of jobs) {
    if (!job.serviceDueAt) continue;
    const due = isServiceChaseDue(
      {
        recurring: job.recurring,
        serviceDueAt: job.serviceDueAt,
        serviceChaseStage: job.serviceChaseStage,
        lastServiceChasedAt: job.lastServiceChasedAt,
        remindWeeks: job.trader.serviceRemindWeeks,
      },
      now,
    );
    if (!due) continue;
    const access = chasersOpen(job.trader);
    if (!featureAllowed({ plan: job.trader.plan, feature: "chasers", sandbox: access.sandbox, billingOn: billingConfigured() })) {
      continue;
    }
    const existing = await prisma.customerChase.findFirst({
      where: { jobId: job.id, stage: 0, status: { in: ["PENDING", "SENT"] } },
    });
    if (existing) continue;
    const copy = serviceChaseCopy({
      businessName: job.trader.businessName,
      customerName: job.customer.name,
      title: job.title,
      dueAt: job.serviceDueAt,
      bookingUrl: `${appUrl}/t/${job.trader.slug}`,
    });
    const release = access.hold ? "queue" : chaseRelease(job.trader.autoSendQuoteChasers, false);
    if (release === "queue") {
      await prisma.customerChase.create({
        data: {
          traderId: job.traderId,
          kind: "SERVICE",
          status: "PENDING",
          jobId: job.id,
          stage: 0,
          subject: copy.subject,
          body: copy.text,
        },
      });
      servicesQueued += 1;
      continue;
    }
    const sent = await deliverCustomerChase({
      traderId: job.traderId,
      traderWhatsapp: job.trader.whatsappE164,
      contact: job.customer.email || job.customer.phone,
      customerPhone: job.customer.phone,
      customerEmail: job.customer.email,
      subject: copy.subject,
      text: copy.text,
      sandbox: access.sandbox,
    });
    await prisma.customerChase.create({
      data: {
        traderId: job.traderId,
        kind: "SERVICE",
        status: sent.ok ? "SENT" : "PENDING",
        jobId: job.id,
        stage: 0,
        subject: copy.subject,
        body: copy.text,
        sentAt: sent.ok ? now : null,
      },
    });
    if (sent.ok) {
      await prisma.job.update({
        where: { id: job.id },
        data: { serviceChaseStage: 1, lastServiceChasedAt: now },
      });
      servicesSent += 1;
    } else {
      servicesQueued += 1;
    }
  }

  return { quotesQueued, quotesSent, servicesQueued, servicesSent };
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
