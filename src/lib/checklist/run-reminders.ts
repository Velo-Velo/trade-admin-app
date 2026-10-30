import { prisma } from "../db";
import { sendEmail } from "../email";
import { isSandboxTrader } from "../sandbox";
import { runFollowUps } from "../followups/run";
import { isDueForReminder, reminderCopy } from "./reminders";

export async function runReminders(now = new Date()): Promise<{
  due: number;
  sent: number;
  stubbed: number;
  failed: number;
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
  const items = await prisma.checklistItem.findMany({
    where: { expiresAt: { not: null }, status: { not: "NOT_APPLICABLE" } },
    include: { trader: { include: { user: true } } },
  });
  const appUrl = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  let due = 0;
  let sent = 0;
  let stubbed = 0;
  let failed = 0;

  for (const item of items) {
    if (!item.expiresAt || !isDueForReminder(item, now)) continue;
    due += 1;
    const copy = reminderCopy({
      title: item.title,
      expiresAt: item.expiresAt,
      officialUrl: item.officialUrl,
      checklistUrl: `${appUrl}/checklist`,
      now,
    });
    try {
      const result = await sendEmail({
        to: item.trader.user.email,
        subject: copy.subject,
        text: `${item.trader.businessName}\n\n${copy.text}`,
        sandbox: isSandboxTrader({ slug: item.trader.slug, email: item.trader.user.email }),
      });
      await prisma.checklistItem.update({
        where: { id: item.id },
        data: { lastRemindedAt: now },
      });
      if (result.stubbed) stubbed += 1;
      else sent += 1;
    } catch (error) {
      failed += 1;
      console.error("[reminders] failed", item.id, error);
    }
  }

  const followUps = await runFollowUps(now);
  console.info(
    `[reminders] due=${due} sent=${sent} stubbed=${stubbed} failed=${failed} invoicesDue=${followUps.invoicesDue} invoicesSent=${followUps.invoicesSent} reviewsDue=${followUps.reviewsDue} reviewsSent=${followUps.reviewsSent} quotesExpired=${followUps.quotesExpired} quotesQueued=${followUps.quotesQueued} quotesSent=${followUps.quotesSent} servicesQueued=${followUps.servicesQueued} servicesSent=${followUps.servicesSent}`,
  );
  return { due, sent, stubbed, failed, ...followUps };
}
