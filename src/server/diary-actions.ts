"use server";

import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { parseDateInput } from "@/lib/format";
import { parseVisitTime, safeDiaryReturn } from "@/lib/diary/month";
import { enforceFeature } from "@/server/guards";
import { redirectWith } from "@/lib/redirects";

export async function addJobVisit(formData: FormData) {
  const user = await getCurrentUser();
  if (!user?.trader) redirectWith("/login", "error", "Sign in to continue.");
  const jobId = String(formData.get("jobId") || "");
  const requested = String(formData.get("returnTo") || "");
  const back = safeDiaryReturn(requested, jobId ? `/jobs/${jobId}` : "/diary");
  enforceFeature(user, "diary", back);
  const job = await prisma.job.findFirst({ where: { id: jobId, traderId: user.trader.id } });
  if (!job) redirectWith("/diary", "error", "That job could not be found.");
  const scheduledFor = parseDateInput(String(formData.get("scheduledFor") || "").trim());
  if (!scheduledFor) redirectWith(back, "error", "Choose the date of the visit.");
  const time = parseVisitTime(String(formData.get("scheduledTime") || ""));
  if (!time.ok) redirectWith(back, "error", time.error);
  const note = String(formData.get("note") || "").trim().slice(0, 140);
  await prisma.jobVisit.create({
    data: {
      traderId: user.trader.id,
      jobId: job.id,
      scheduledFor,
      scheduledTime: time.time,
      note,
    },
  });
  redirectWith(back, "notice", "Visit added to the diary. The customer has not been told.");
}

export async function deleteJobVisit(formData: FormData) {
  const user = await getCurrentUser();
  if (!user?.trader) redirectWith("/login", "error", "Sign in to continue.");
  const id = String(formData.get("visitId") || "");
  const requested = String(formData.get("returnTo") || "");
  const visit = await prisma.jobVisit.findFirst({ where: { id, traderId: user.trader.id } });
  const back = safeDiaryReturn(requested, visit ? `/jobs/${visit.jobId}` : "/diary");
  enforceFeature(user, "diary", back);
  if (!visit) redirectWith(back, "error", "That visit could not be found.");
  await prisma.jobVisit.delete({ where: { id: visit.id } });
  redirectWith(back, "notice", "Visit removed from the diary. Nothing was sent to the customer.");
}
