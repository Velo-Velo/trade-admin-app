import type { PrismaClient } from "@prisma/client";
import { lookupNearestAe } from "./ae";

/** Fills an empty nearest A&E from the site postcode. Leaves a typed value alone, and does nothing if the lookup is down. */
export async function fillNearestHospital(db: PrismaClient, ramsId: string): Promise<void> {
  const rams = await db.rams.findUnique({
    where: { id: ramsId },
    select: { nearestHospital: true, sitePostcode: true, status: true },
  });
  if (!rams || rams.nearestHospital.trim() || !rams.sitePostcode.trim()) return;
  if (rams.status === "SIGNED" || rams.status === "ISSUED") return;
  const lookup = await lookupNearestAe(rams.sitePostcode);
  if (!lookup.ok || lookup.suggestions.length === 0) return;
  await db.rams.update({
    where: { id: ramsId },
    data: { nearestHospital: lookup.suggestions[0].name.slice(0, 240) },
  });
}
