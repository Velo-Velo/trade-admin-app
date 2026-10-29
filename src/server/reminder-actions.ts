"use server";

import { dueAfterJobDate, parseServiceReminder } from "@/lib/chasers/plan";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { enforceFeature } from "@/server/guards";
import { redirectWith } from "@/lib/redirects";

export async function saveCustomerReminder(formData: FormData) {
  const user = await getCurrentUser();
  if (!user?.trader) redirectWith("/login", "error", "Sign in to continue.");
  const customerId = String(formData.get("customerId") || "");
  const back = `/customers/${customerId}`;
  enforceFeature(user, "chasers", back);
  const customer = await prisma.customer.findFirst({ where: { id: customerId, traderId: user.trader.id } });
  if (!customer) redirectWith("/customers", "error", "That customer could not be found.");
  const parsed = parseServiceReminder({
    title: String(formData.get("title") || ""),
    intervalMonths: String(formData.get("intervalMonths") || ""),
    dueAt: String(formData.get("dueAt") || ""),
    enabled: formData.get("enabled") === "on",
  });
  if (!parsed.ok) redirectWith(back, "error", parsed.error);

  const reminderId = String(formData.get("reminderId") || "");
  if (!reminderId) {
    await prisma.serviceReminder.create({
      data: {
        traderId: user.trader.id,
        customerId: customer.id,
        title: parsed.data.title,
        intervalMonths: parsed.data.intervalMonths,
        dueAt: parsed.data.dueAt,
        enabled: parsed.data.enabled,
      },
    });
    redirectWith(back, "notice", "Reminder saved. The customer is not messaged until it is due and you send it.");
  }

  const existing = await prisma.serviceReminder.findFirst({
    where: { id: reminderId, traderId: user.trader.id, customerId: customer.id },
  });
  if (!existing) redirectWith(back, "error", "That reminder could not be found.");
  const previous = existing.dueAt.toISOString().slice(0, 10);
  const next = parsed.data.dueAt.toISOString().slice(0, 10);
  const dateChanged = previous !== next;
  await prisma.serviceReminder.update({
    where: { id: existing.id },
    data: {
      title: parsed.data.title,
      intervalMonths: parsed.data.intervalMonths,
      dueAt: parsed.data.dueAt,
      enabled: parsed.data.enabled,
      ...(dateChanged ? { chaseStage: 0, lastChasedAt: null } : {}),
    },
  });
  if (dateChanged) {
    await prisma.customerChase.deleteMany({ where: { serviceReminderId: existing.id } });
  } else if (!parsed.data.enabled) {
    await prisma.customerChase.deleteMany({ where: { serviceReminderId: existing.id, status: "PENDING" } });
  }
  redirectWith(back, "notice", parsed.data.enabled ? "Reminder saved. Nothing has been sent." : "Reminder switched off. Nothing has been sent.");
}

export async function markReminderDone(formData: FormData) {
  const user = await getCurrentUser();
  if (!user?.trader) redirectWith("/login", "error", "Sign in to continue.");
  const customerId = String(formData.get("customerId") || "");
  const back = `/customers/${customerId}`;
  enforceFeature(user, "chasers", back);
  const reminder = await prisma.serviceReminder.findFirst({
    where: { id: String(formData.get("reminderId") || ""), traderId: user.trader.id, customerId },
  });
  if (!reminder) redirectWith(back, "error", "That reminder could not be found.");
  const dueAt = dueAfterJobDate(new Date(), reminder.intervalMonths);
  await prisma.customerChase.deleteMany({ where: { serviceReminderId: reminder.id } });
  await prisma.serviceReminder.update({
    where: { id: reminder.id },
    data: { dueAt, chaseStage: 0, lastChasedAt: null, enabled: true },
  });
  redirectWith(back, "notice", "Marked done. The next reminder is set from today. Nothing has been sent.");
}

export async function deleteCustomerReminder(formData: FormData) {
  const user = await getCurrentUser();
  if (!user?.trader) redirectWith("/login", "error", "Sign in to continue.");
  const customerId = String(formData.get("customerId") || "");
  const back = `/customers/${customerId}`;
  const reminder = await prisma.serviceReminder.findFirst({
    where: { id: String(formData.get("reminderId") || ""), traderId: user.trader.id, customerId },
  });
  if (!reminder) redirectWith(back, "error", "That reminder could not be found.");
  await prisma.serviceReminder.delete({ where: { id: reminder.id } });
  redirectWith(back, "notice", "Reminder removed. Nothing has been sent.");
}
