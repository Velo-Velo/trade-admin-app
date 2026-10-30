import { listUpcomingReminders } from "./plan";
import { prisma } from "../db";
import type { ReminderListItem } from "@/components/reminder-list";

export async function loadUpcomingReminders(traderId: string, now = new Date()): Promise<ReminderListItem[]> {
  const [jobs, reminders] = await Promise.all([
    prisma.job.findMany({
      where: { traderId, recurring: true, serviceDueAt: { not: null } },
      include: { customer: { select: { name: true } } },
    }),
    prisma.serviceReminder.findMany({
      where: { traderId, enabled: true },
      include: { customer: { select: { name: true } } },
    }),
  ]);
  const items: ReminderListItem[] = [
    ...jobs.flatMap((job) =>
      job.serviceDueAt
        ? [{ id: `job-${job.id}`, title: job.title, customerName: job.customer.name, dueAt: job.serviceDueAt, href: `/jobs/${job.id}` }]
        : [],
    ),
    ...reminders.map((reminder) => ({
      id: `reminder-${reminder.id}`,
      title: reminder.title,
      customerName: reminder.customer.name,
      dueAt: reminder.dueAt,
      href: `/customers/${reminder.customerId}`,
    })),
  ];
  return listUpcomingReminders(items, now);
}
