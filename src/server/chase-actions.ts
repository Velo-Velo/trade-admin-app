"use server";

import { deliverCustomerChase } from "@/lib/chasers/deliver";
import { parseFollowUpSettings } from "@/lib/chasers/plan";
import { stopQuoteChases } from "@/lib/chasers/queue";
import { getCurrentUser } from "@/lib/auth";
import { enforceFeature, enforceVerified, traderSandbox } from "@/server/guards";
import { prisma } from "@/lib/db";
import { markQuoteLost } from "@/lib/quotes/approval";
import { redirectWith } from "@/lib/redirects";

async function requireTrader() {
  const user = await getCurrentUser();
  return user?.trader ?? null;
}

export async function updateFollowUpSettings(formData: FormData) {
  const trader = await requireTrader();
  if (!trader) redirectWith("/login", "error", "Sign in to continue.");
  const parsed = parseFollowUpSettings({
    quoteChasersEnabled: formData.get("quoteChasersEnabled") === "on",
    quoteChaseDays: String(formData.get("quoteChaseDays") || ""),
    quoteChaseSecondNudge: formData.get("quoteChaseSecondNudge") === "on",
    quoteChaseSecondDays: String(formData.get("quoteChaseSecondDays") || ""),
    quoteValidDays: String(formData.get("quoteValidDays") || ""),
    serviceRemindWeeks: String(formData.get("serviceRemindWeeks") || ""),
    autoSendQuoteChasers: formData.get("autoSendQuoteChasers") === "on",
  });
  if (!parsed.ok) redirectWith("/business", "error", parsed.error);
  await prisma.trader.update({ where: { id: trader.id }, data: parsed.data });
  redirectWith("/business", "notice", "Follow-up settings saved. Nothing is sent until you approve it, unless auto-send is on.");
}

export async function setQuoteChaseEnabled(formData: FormData) {
  const trader = await requireTrader();
  if (!trader) redirectWith("/login", "error", "Sign in to continue.");
  const id = String(formData.get("quoteId") || "");
  const quote = await prisma.quote.findFirst({ where: { id, traderId: trader.id } });
  if (!quote) redirectWith("/quotes", "error", "That quote could not be found.");
  if (quote.status !== "SENT") {
    redirectWith(`/quotes/${quote.id}`, "error", "Follow-ups only run on a quote that is still waiting for a reply.");
  }
  const chaseEnabled = formData.get("chaseEnabled") === "on";
  await prisma.quote.update({ where: { id: quote.id }, data: { chaseEnabled } });
  if (!chaseEnabled) {
    await stopQuoteChases(quote.id, "Follow-ups switched off for this quote. Nothing was sent.");
    redirectWith(`/quotes/${quote.id}`, "notice", "Follow-ups are off for this quote. Nothing was sent.");
  }
  redirectWith(`/quotes/${quote.id}`, "notice", "Follow-ups are on for this quote. Nothing is sent until it is due.");
}

export async function markQuoteLostAction(formData: FormData) {
  const trader = await requireTrader();
  if (!trader) redirectWith("/login", "error", "Sign in to continue.");
  const id = String(formData.get("quoteId") || "");
  const quote = await prisma.quote.findFirst({ where: { id, traderId: trader.id } });
  if (!quote) redirectWith("/quotes", "error", "That quote could not be found.");
  try {
    markQuoteLost(quote.status);
  } catch (error) {
    redirectWith(`/quotes/${quote.id}`, "error", error instanceof Error ? error.message : "This quote cannot be marked lost.");
  }
  await prisma.quote.update({
    where: { id: quote.id },
    data: { status: "LOST", lostAt: new Date() },
  });
  await stopQuoteChases(quote.id, "Marked lost. Follow-ups stopped. The customer was not emailed.");
  redirectWith(`/quotes/${quote.id}`, "notice", "Quote marked lost. Follow-ups have stopped. The customer has not been emailed.");
}

async function loadPending(traderId: string, chaseId: string) {
  return prisma.customerChase.findFirst({
    where: { id: chaseId, traderId, status: "PENDING" },
    include: {
      quote: { include: { customer: true } },
      job: { include: { customer: true, trader: true } },
    },
  });
}

export async function sendChase(formData: FormData) {
  const user = await getCurrentUser();
  if (!user?.trader) redirectWith("/login", "error", "Sign in to continue.");
  enforceFeature(user, "chasers", "/follow-ups");
  enforceVerified(user, "/follow-ups");
  const trader = user.trader;
  const chase = await loadPending(trader.id, String(formData.get("chaseId") || ""));
  if (!chase) redirectWith("/follow-ups", "error", "That reminder is no longer waiting to be sent.");
  const account = await prisma.trader.findUnique({ where: { id: trader.id } });
  if (!account) redirectWith("/follow-ups", "error", "That reminder is no longer waiting to be sent.");

  const customer = chase.quote?.customer ?? chase.job?.customer ?? null;
  const contact = chase.quote?.customerContact || customer?.email || customer?.phone || "";
  const sent = await deliverCustomerChase({
    traderId: trader.id,
    traderWhatsapp: account.whatsappE164,
    contact,
    customerPhone: customer?.phone ?? "",
    customerEmail: customer?.email ?? "",
    subject: chase.subject,
    text: chase.body,
    sandbox: traderSandbox(user),
  });
  if (!sent.ok) redirectWith("/follow-ups", "error", sent.detail);

  const now = new Date();
  await prisma.customerChase.update({
    where: { id: chase.id },
    data: { status: "SENT", sentAt: now },
  });
  if (chase.quoteId) {
    await prisma.quote.update({
      where: { id: chase.quoteId },
      data: { chaseStage: chase.stage + 1, lastChasedAt: now },
    });
    await prisma.quoteEvent.create({
      data: { quoteId: chase.quoteId, type: "chase_sent", channel: "web", detail: sent.detail },
    });
  }
  if (chase.jobId) {
    await prisma.job.update({
      where: { id: chase.jobId },
      data: { serviceChaseStage: chase.stage + 1, lastServiceChasedAt: now },
    });
  }
  if (chase.serviceReminderId) {
    await prisma.serviceReminder.update({
      where: { id: chase.serviceReminderId },
      data: { chaseStage: chase.stage + 1, lastChasedAt: now },
    });
  }
  redirectWith("/follow-ups", "notice", sent.detail);
}

export async function dismissChase(formData: FormData) {
  const trader = await requireTrader();
  if (!trader) redirectWith("/login", "error", "Sign in to continue.");
  const chase = await loadPending(trader.id, String(formData.get("chaseId") || ""));
  if (!chase) redirectWith("/follow-ups", "error", "That reminder is no longer waiting.");
  const now = new Date();
  await prisma.customerChase.update({
    where: { id: chase.id },
    data: { status: "DISMISSED" },
  });
  if (chase.quoteId) {
    await prisma.quote.update({
      where: { id: chase.quoteId },
      data: { chaseStage: chase.stage + 1, lastChasedAt: now },
    });
    await prisma.quoteEvent.create({
      data: {
        quoteId: chase.quoteId,
        type: "chase_dismissed",
        channel: "web",
        detail: "Follow-up dismissed. It was not sent.",
      },
    });
  }
  if (chase.jobId) {
    await prisma.job.update({
      where: { id: chase.jobId },
      data: { serviceChaseStage: chase.stage + 1, lastServiceChasedAt: now },
    });
  }
  if (chase.serviceReminderId) {
    await prisma.serviceReminder.update({
      where: { id: chase.serviceReminderId },
      data: { chaseStage: chase.stage + 1, lastChasedAt: now },
    });
  }
  redirectWith("/follow-ups", "notice", "Reminder dismissed. It was not sent.");
}
