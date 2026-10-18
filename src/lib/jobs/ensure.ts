import { photoBytes, prepareJobPhoto } from "../images/prepare";
import { findOrCreateCustomer, type Db } from "../customers/store";
import { bookedJobPlan, JOB_PHOTO_LIMIT, jobTitleFromDescription } from "./board";

export async function copyEnquiryPhotosOntoJob(db: Db, jobId: string, enquiryId: string): Promise<number> {
  const [photos, existing] = await Promise.all([
    db.enquiryPhoto.findMany({ where: { enquiryId }, orderBy: { createdAt: "asc" } }),
    db.jobPhoto.count({ where: { jobId } }),
  ]);
  let copied = 0;
  for (const photo of photos) {
    if (existing + copied >= JOB_PHOTO_LIMIT) break;
    const prepared = await prepareJobPhoto(new Uint8Array(photo.bytes));
    if (!prepared.ok) continue;
    await db.jobPhoto.create({
      data: {
        jobId,
        kind: "BEFORE",
        filename: photo.filename || "enquiry-photo.jpg",
        mimeType: prepared.mimeType,
        bytes: photoBytes(prepared.bytes),
      },
    });
    copied += 1;
  }
  return copied;
}

/** An accepted quote gets one Booked job. Calling this again does not create a second job. */
export async function ensureBookedJob(db: Db, quoteId: string) {
  const existing = await db.job.findUnique({ where: { quoteId } });
  if (existing) return existing;
  const quote = await db.quote.findUnique({
    where: { id: quoteId },
    include: { enquiry: { select: { id: true } } },
  });
  if (!quote || !bookedJobPlan(quote.status)) return null;
  const customer = quote.customerId
    ? await db.customer.findUnique({ where: { id: quote.customerId } })
    : await findOrCreateCustomer(db, {
        traderId: quote.traderId,
        name: quote.customerName,
        contact: quote.customerContact,
        postcode: quote.postcode,
      });
  if (!customer) return null;
  if (!quote.customerId) {
    await db.quote.update({ where: { id: quote.id }, data: { customerId: customer.id } });
    if (quote.enquiry) {
      await db.enquiry.update({ where: { id: quote.enquiry.id }, data: { customerId: customer.id } });
    }
  }
  const job = await db.job.create({
    data: {
      traderId: quote.traderId,
      customerId: customer.id,
      quoteId: quote.id,
      title: jobTitleFromDescription(quote.jobDescription),
      postcode: quote.postcode === "Not given" ? "" : quote.postcode,
      status: "BOOKED",
      bookedAt: quote.acceptedAt ?? new Date(),
    },
  });
  if (quote.enquiry) await copyEnquiryPhotosOntoJob(db, job.id, quote.enquiry.id);
  return job;
}

export async function ensureBookedJobsForTrader(db: Db, traderId: string): Promise<number> {
  const quotes = await db.quote.findMany({
    where: { traderId, status: "ACCEPTED", job: null },
    select: { id: true },
  });
  for (const quote of quotes) {
    await ensureBookedJob(db, quote.id);
  }
  return quotes.length;
}
