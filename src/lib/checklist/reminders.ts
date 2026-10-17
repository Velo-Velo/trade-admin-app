import { formatDate } from "../format";

export function isDueForReminder(
  item: {
    expiresAt: Date | null;
    status: string;
    reminderDays: number;
    lastRemindedAt: Date | null;
  },
  now: Date,
): boolean {
  if (!item.expiresAt) return false;
  if (item.status === "NOT_APPLICABLE") return false;
  const days = item.reminderDays > 0 ? item.reminderDays : 30;
  const start = item.expiresAt.getTime() - days * 24 * 60 * 60 * 1000;
  if (now.getTime() < start) return false;
  if (item.lastRemindedAt) {
    const week = 7 * 24 * 60 * 60 * 1000;
    if (now.getTime() - item.lastRemindedAt.getTime() < week) return false;
  }
  return true;
}

export function reminderCopy(input: {
  title: string;
  expiresAt: Date;
  officialUrl: string;
  checklistUrl: string;
  now: Date;
}): { subject: string; text: string } {
  const overdue = input.expiresAt.getTime() < input.now.getTime();
  const when = formatDate(input.expiresAt);
  const subject = overdue ? `Overdue: ${input.title}` : `Renewal reminder: ${input.title}`;
  const text = [
    overdue ? `${input.title} expired on ${when}.` : `${input.title} expires on ${when}.`,
    "",
    "Open your checklist to update the date or mark it done:",
    input.checklistUrl,
    "",
    "Official page:",
    input.officialUrl,
    "",
    "This is an automatic reminder from Quotestick. It is not legal or tax advice.",
  ].join("\n");
  return { subject, text };
}
