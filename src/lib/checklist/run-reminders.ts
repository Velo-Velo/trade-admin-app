import { prisma } from "../db";
import { sendEmail } from "../email";
import { isDueForReminder, reminderCopy } from "./reminders";

export async function runReminders(now = new Date()): Promise<{
  due: number;
  sent: number;
  stubbed: number;
  failed: number;
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

  console.info(`[reminders] due=${due} sent=${sent} stubbed=${stubbed} failed=${failed}`);
  return { due, sent, stubbed, failed };
}
