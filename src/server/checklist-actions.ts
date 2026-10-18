"use server";

import type { ChecklistStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { parseDateInput } from "@/lib/format";
import { redirectWith } from "@/lib/redirects";
import { redirect } from "next/navigation";

const STATUSES: ChecklistStatus[] = ["NOT_STARTED", "IN_PROGRESS", "DONE", "NOT_APPLICABLE"];

export async function updateChecklistItem(formData: FormData) {
  const user = await getCurrentUser();
  if (!user?.trader) redirect("/onboarding");
  const id = String(formData.get("id") || "");
  const item = await prisma.checklistItem.findFirst({
    where: { id, traderId: user.trader.id },
  });
  if (!item) redirectWith("/checklist", "error", "That checklist item could not be found.");

  const status = String(formData.get("status") || "") as ChecklistStatus;
  if (!STATUSES.includes(status)) {
    redirectWith("/checklist", "error", "Choose a status.");
  }
  const referenceNumber = String(formData.get("referenceNumber") || "").trim().slice(0, 80);
  const expiresAt = parseDateInput(String(formData.get("expiresAt") || ""));
  if (String(formData.get("expiresAt") || "") && !expiresAt) {
    redirectWith("/checklist", "error", "Enter the expiry date as a calendar date.");
  }
  const reminderDays = Number(formData.get("reminderDays") || item.reminderDays);
  if (!Number.isInteger(reminderDays) || reminderDays < 1 || reminderDays > 180) {
    redirectWith("/checklist", "error", "Reminder days need to be a whole number from 1 to 180.");
  }
  const wantsBadge = formData.get("showOnWebsite") === "on";
  if (wantsBadge && !item.badgeLabel) {
    redirectWith("/checklist", "error", "This item is not shown as a badge on your page.");
  }
  if (wantsBadge && (status !== "DONE" || !referenceNumber)) {
    redirectWith(
      "/checklist",
      "error",
      "To show a badge, mark the item done and enter the registration or policy number.",
    );
  }

  await prisma.checklistItem.update({
    where: { id: item.id },
    data: {
      status,
      referenceNumber,
      expiresAt,
      reminderDays,
      showOnWebsite: wantsBadge,
    },
  });
  redirectWith("/checklist", "notice", "Checklist updated.");
}
