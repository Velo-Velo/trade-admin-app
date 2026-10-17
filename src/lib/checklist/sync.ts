import type { Trade } from "@prisma/client";
import { prisma } from "@/lib/db";
import { checklistForTrade } from "@/lib/checklist/catalog";

export async function syncChecklist(traderId: string, trade: Trade): Promise<void> {
  const templates = checklistForTrade(trade);
  for (const item of templates) {
    await prisma.checklistItem.upsert({
      where: { traderId_key: { traderId, key: item.key } },
      create: {
        traderId,
        key: item.key,
        title: item.title,
        detail: item.detail,
        officialUrl: item.officialUrl,
        verifyUrl: item.verifyUrl,
        badgeLabel: item.badgeLabel,
        publicRegister: item.publicRegister,
        reminderDays: item.reminderDays,
        sortOrder: item.sortOrder,
      },
      update: {
        title: item.title,
        detail: item.detail,
        officialUrl: item.officialUrl,
        verifyUrl: item.verifyUrl,
        badgeLabel: item.badgeLabel,
        publicRegister: item.publicRegister,
        sortOrder: item.sortOrder,
      },
    });
  }
}
