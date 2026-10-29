import { billingConfigured, featureAllowed, sendBlockReason } from "../billing/plans";
import { queueCustomerChases } from "../chasers/queue";
import { prisma } from "../db";
import { sendEmail } from "../email";
import { isSandboxTrader } from "../sandbox";
import { customerEmail } from "../format";
import { chaserCopy, isInvoiceChaserDue } from "../invoices/chasers";
import { isReviewDue, reviewCopy } from "../reviews/sequence";
import { customerChaseChannel } from "../whatsapp/plan";

function origin(): string {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

export async function runFollowUps(now = new Date()): Promise<{
  invoicesDue: number;
  invoicesSent: number;
  reviewsDue: number;
  reviewsSent: number;
  quotesExpired: number;
  quotesQueued: number;
  quotesSent: number;
  servicesQueued: number;
  servicesSent: number;
}> {
  const appUrl = origin();
  let invoicesDue = 0;
  let invoicesSent = 0;
  let reviewsDue = 0;
  let reviewsSent = 0;

  const invoices = await prisma.invoice.findMany({
    where: { status: "SENT", paidAt: null, chaserEnabled: true },
    include: { trader: { include: { user: true } } },
  });
  for (const invoice of invoices) {
    if (!isInvoiceChaserDue(invoice, now)) continue;
    const sandbox = isSandboxTrader({ slug: invoice.trader.slug, email: invoice.trader.user.email });
    if (!featureAllowed({ plan: invoice.trader.plan, feature: "invoices", sandbox, billingOn: billingConfigured() })) continue;
    if (sendBlockReason({ emailVerifiedAt: invoice.trader.user.emailVerifiedAt, sandbox })) continue;
    invoicesDue += 1;
    const email = customerEmail(invoice.customerContact);
    const copy = chaserCopy({
      stage: invoice.chaserStage,
      businessName: invoice.businessName,
      number: invoice.number,
      customerName: invoice.customerName,
      totalPence: invoice.totalPence,
      dueAt: invoice.dueAt,
      paymentUrl: invoice.stripePaymentUrl,
      invoiceUrl: `${appUrl}/i/${invoice.publicToken}`,
    });
    if (!email || customerChaseChannel() !== "email") {
      await prisma.invoice.update({ where: { id: invoice.id }, data: { lastChasedAt: now } });
      await prisma.invoiceEvent.create({
        data: {
          invoiceId: invoice.id,
          type: "chaser_skipped",
          channel: "email",
          detail: "Reminder not emailed. Add an email address for the customer. WhatsApp to customers is not connected yet.",
        },
      });
      continue;
    }
    try {
      const result = await sendEmail({ to: email, subject: copy.subject, text: copy.text, sandbox });
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: { chaserStage: invoice.chaserStage + 1, lastChasedAt: now },
      });
      await prisma.invoiceEvent.create({
        data: {
          invoiceId: invoice.id,
          type: "chaser_sent",
          channel: "email",
          detail: result.stubbed ? `Reminder ${invoice.chaserStage + 1} logged, not emailed.` : `Reminder ${invoice.chaserStage + 1} emailed.`,
        },
      });
      invoicesSent += 1;
    } catch (error) {
      console.error("[invoice chaser]", invoice.id, error);
    }
  }

  const reviewInvoices = await prisma.invoice.findMany({
    where: { jobCompletedAt: { not: null }, reviewClickedAt: null, reviewChaserEnabled: true },
    include: { trader: { include: { user: true } } },
  });
  for (const invoice of reviewInvoices) {
    const email = customerEmail(invoice.customerContact);
    const due = isReviewDue(
      {
        reviewChaserEnabled: invoice.reviewChaserEnabled,
        traderEnabled: invoice.trader.reviewChasersEnabled,
        reviewStage: invoice.reviewStage,
        reviewClickedAt: invoice.reviewClickedAt,
        jobCompletedAt: invoice.jobCompletedAt,
        lastReviewAt: invoice.lastReviewAt,
        hasReviewUrl: invoice.trader.googleReviewUrl.startsWith("https://"),
        hasEmail: Boolean(email),
      },
      now,
    );
    if (!due || !email) continue;
    const sandbox = isSandboxTrader({ slug: invoice.trader.slug, email: invoice.trader.user.email });
    if (!featureAllowed({ plan: invoice.trader.plan, feature: "invoices", sandbox, billingOn: billingConfigured() })) continue;
    if (sendBlockReason({ emailVerifiedAt: invoice.trader.user.emailVerifiedAt, sandbox })) continue;
    reviewsDue += 1;
    const copy = reviewCopy({
      stage: invoice.reviewStage,
      businessName: invoice.businessName,
      customerName: invoice.customerName,
      trackUrl: `${appUrl}/r/${invoice.reviewToken}`,
    });
    try {
      const result = await sendEmail({ to: email, subject: copy.subject, text: copy.text, sandbox });
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: { reviewStage: invoice.reviewStage + 1, lastReviewAt: now },
      });
      await prisma.invoiceEvent.create({
        data: {
          invoiceId: invoice.id,
          type: "review_sent",
          channel: "email",
          detail: result.stubbed ? "Review note logged, not emailed." : "Review note emailed.",
        },
      });
      reviewsSent += 1;
    } catch (error) {
      console.error("[review chaser]", invoice.id, error);
    }
  }

  const reviewQuotes = await prisma.quote.findMany({
    where: { jobCompletedAt: { not: null }, reviewClickedAt: null, reviewChaserEnabled: true, reviewToken: { not: null } },
    include: { trader: { include: { user: true } } },
  });
  for (const quote of reviewQuotes) {
    const email = customerEmail(quote.customerContact);
    const due = isReviewDue(
      {
        reviewChaserEnabled: quote.reviewChaserEnabled,
        traderEnabled: quote.trader.reviewChasersEnabled,
        reviewStage: quote.reviewStage,
        reviewClickedAt: quote.reviewClickedAt,
        jobCompletedAt: quote.jobCompletedAt,
        lastReviewAt: quote.lastReviewAt,
        hasReviewUrl: quote.trader.googleReviewUrl.startsWith("https://"),
        hasEmail: Boolean(email),
      },
      now,
    );
    if (!due || !email || !quote.reviewToken) continue;
    const sandbox = isSandboxTrader({ slug: quote.trader.slug, email: quote.trader.user.email });
    if (!featureAllowed({ plan: quote.trader.plan, feature: "chasers", sandbox, billingOn: billingConfigured() })) continue;
    if (sendBlockReason({ emailVerifiedAt: quote.trader.user.emailVerifiedAt, sandbox })) continue;
    reviewsDue += 1;
    const copy = reviewCopy({
      stage: quote.reviewStage,
      businessName: quote.trader.businessName,
      customerName: quote.customerName,
      trackUrl: `${appUrl}/r/${quote.reviewToken}`,
    });
    try {
      await sendEmail({ to: email, subject: copy.subject, text: copy.text, sandbox });
      await prisma.quote.update({
        where: { id: quote.id },
        data: { reviewStage: quote.reviewStage + 1, lastReviewAt: now },
      });
      reviewsSent += 1;
    } catch (error) {
      console.error("[review chaser quote]", quote.id, error);
    }
  }

  const chases = await queueCustomerChases(now);
  return { invoicesDue, invoicesSent, reviewsDue, reviewsSent, ...chases };
}
