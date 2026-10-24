"use server";

import { redirect } from "next/navigation";
import { clearSessionCookie, getCurrentUser, normaliseEmail } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirectWith } from "@/lib/redirects";

export async function deleteAccount(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const confirm = normaliseEmail(String(formData.get("confirmEmail") || ""));
  if (confirm !== user.email) {
    redirectWith("/account", "error", "Type the account email to confirm deletion.");
  }
  await prisma.user.delete({ where: { id: user.id } });
  await clearSessionCookie();
  redirectWith("/login", "notice", "The account and the data stored for it have been deleted.");
}
