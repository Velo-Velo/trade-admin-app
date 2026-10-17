"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { createEnquiryAndDraft } from "@/lib/enquiries/create-draft";
import { requestOrigin } from "@/lib/origin";
import { readEnquiryPhotos } from "@/lib/uploads";
import { parseEnquiryFields } from "@/lib/validation";
import { redirectWith } from "@/lib/redirects";

export async function submitEnquiry(formData: FormData) {
  const slug = String(formData.get("slug") || "");
  const trader = await prisma.trader.findUnique({ where: { slug } });
  if (!trader) redirect("/");
  if (String(formData.get("company_website") || "").trim()) {
    redirect(`/t/${slug}/thanks`);
  }
  const parsed = parseEnquiryFields({
    customerName: String(formData.get("customerName") || ""),
    contact: String(formData.get("contact") || ""),
    postcode: String(formData.get("postcode") || ""),
    jobDescription: String(formData.get("jobDescription") || ""),
  });
  if (!parsed.ok) redirectWith(`/t/${slug}`, "error", parsed.error);
  const photos = await readEnquiryPhotos(formData);
  if (!photos.ok) redirectWith(`/t/${slug}`, "error", photos.error);
  const origin = await requestOrigin();
  await createEnquiryAndDraft({
    traderId: trader.id,
    ...parsed.data,
    source: "website",
    photos: photos.photos,
    origin,
  });
  redirect(`/t/${slug}/thanks`);
}

export async function createManualQuote(formData: FormData) {
  const user = await getCurrentUser();
  if (!user?.trader) redirect("/onboarding");
  const parsed = parseEnquiryFields({
    customerName: String(formData.get("customerName") || ""),
    contact: String(formData.get("contact") || ""),
    postcode: String(formData.get("postcode") || ""),
    jobDescription: String(formData.get("jobDescription") || ""),
  });
  if (!parsed.ok) redirectWith("/quotes/new", "error", parsed.error);
  const origin = await requestOrigin();
  const created = await createEnquiryAndDraft({
    traderId: user.trader.id,
    ...parsed.data,
    source: "manual",
    photos: [],
    origin,
  });
  redirect(`/quotes/${created.quoteId}`);
}
