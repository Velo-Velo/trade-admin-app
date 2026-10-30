"use server";

import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { photoBytes, prepareJobPhoto } from "@/lib/images/prepare";
import { parseExpenseEdit } from "@/lib/receipts/fields";
import { readReceiptFields, readerFromEnv } from "@/lib/receipts/read";
import { redirectWith } from "@/lib/redirects";

async function requireTraderId(): Promise<string> {
  const user = await getCurrentUser();
  if (!user?.trader) redirectWith("/login", "error", "Sign in to continue.");
  return user.trader.id;
}

export async function uploadReceipt(formData: FormData) {
  const traderId = await requireTraderId();
  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) redirectWith("/receipts", "error", "Choose a photo of the receipt.");
  const prepared = await prepareJobPhoto(new Uint8Array(await file.arrayBuffer()));
  if (!prepared.ok) redirectWith("/receipts", "error", prepared.error);
  const caption = String(formData.get("note") || "").trim().slice(0, 500);
  const jobs = await prisma.job.findMany({
    where: { traderId },
    orderBy: { updatedAt: "desc" },
    take: 40,
    select: {
      id: true,
      customerId: true,
      title: true,
      address: true,
      postcode: true,
      customer: { select: { name: true } },
    },
  });
  const draft = await readReceiptFields({
    caption,
    jobs: jobs.map((job) => ({
      id: job.id,
      customerId: job.customerId,
      title: job.title,
      customerName: job.customer.name,
      address: job.address,
      postcode: job.postcode,
    })),
    bytes: new Uint8Array(prepared.bytes),
    mimeType: prepared.mimeType,
    read: readerFromEnv(),
  });
  const filename = file.name.replace(/[^\w.\- ]+/g, "").slice(0, 80) || "receipt.jpg";
  const expense = await prisma.expense.create({
    data: {
      traderId,
      supplier: draft.supplier,
      description: draft.description,
      spentOn: draft.spentOn ? new Date(`${draft.spentOn}T00:00:00.000Z`) : null,
      totalPence: draft.totalPence,
      vatPence: draft.vatPence,
      category: draft.category,
      extractionNote: draft.extractionNote,
      imageFilename: filename,
      imageMime: prepared.mimeType,
      imageBytes: photoBytes(prepared.bytes),
      source: "upload",
      jobId: draft.jobId,
      customerId: draft.customerId,
      status: "NEEDS_REVIEW",
    },
    select: { id: true },
  });
  redirectWith(`/receipts/${expense.id}`, "notice", "Receipt photo saved. Check the supplier, date, total and any VAT the receipt shows.");
}

type OwnedLinks = { error: string } | { jobId: string | null; customerId: string | null };

async function ownedLinks(traderId: string, jobId: string | null, customerId: string | null): Promise<OwnedLinks> {
  if (jobId) {
    const job = await prisma.job.findFirst({ where: { id: jobId, traderId }, select: { id: true, customerId: true } });
    if (!job) return { error: "That job is not on your account." };
    return { jobId: job.id, customerId: job.customerId };
  }
  if (customerId) {
    const customer = await prisma.customer.findFirst({ where: { id: customerId, traderId }, select: { id: true } });
    if (!customer) return { error: "That customer is not on your account." };
    return { jobId: null, customerId: customer.id };
  }
  return { jobId: null, customerId: null };
}

export async function saveReceipt(formData: FormData) {
  const traderId = await requireTraderId();
  const id = String(formData.get("expenseId") || "");
  const existing = await prisma.expense.findFirst({ where: { id, traderId }, select: { id: true, status: true } });
  if (!existing) redirectWith("/receipts", "error", "That receipt could not be found.");
  const mode = formData.get("intent") === "confirm" ? "confirm" : "save";
  const parsed = parseExpenseEdit(
    {
      supplier: String(formData.get("supplier") || ""),
      description: String(formData.get("description") || ""),
      spentOn: String(formData.get("spentOn") || ""),
      total: String(formData.get("total") || ""),
      vat: String(formData.get("vat") || ""),
      category: String(formData.get("category") || ""),
      jobId: String(formData.get("jobId") || ""),
      customerId: String(formData.get("customerId") || ""),
    },
    mode,
  );
  if (!parsed.ok) redirectWith(`/receipts/${id}`, "error", parsed.error);
  const links = await ownedLinks(traderId, parsed.data.jobId, parsed.data.customerId);
  if ("error" in links) {
    redirectWith(`/receipts/${id}`, "error", links.error);
  }
  await prisma.expense.update({
    where: { id },
    data: {
      supplier: parsed.data.supplier,
      description: parsed.data.description,
      spentOn: parsed.data.spentOn,
      totalPence: parsed.data.totalPence,
      vatPence: parsed.data.vatPence,
      category: parsed.data.category,
      jobId: links.jobId,
      customerId: links.customerId,
      ...(mode === "confirm" ? { status: "CONFIRMED" as const, confirmedAt: new Date() } : {}),
    },
  });
  const notice =
    mode === "confirm"
      ? "Receipt confirmed. It stays in your records for you and your accountant."
      : existing.status === "CONFIRMED"
        ? "Receipt updated."
        : "Receipt updated. It is still waiting for you to confirm.";
  redirectWith(`/receipts/${id}`, "notice", notice);
}

export async function deleteReceipt(formData: FormData) {
  const traderId = await requireTraderId();
  const id = String(formData.get("expenseId") || "");
  const existing = await prisma.expense.findFirst({ where: { id, traderId }, select: { id: true } });
  if (!existing) redirectWith("/receipts", "error", "That receipt could not be found.");
  await prisma.expense.delete({ where: { id } });
  redirectWith("/receipts", "notice", "Receipt deleted.");
}
