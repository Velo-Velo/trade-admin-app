"use server";

import { randomBytes } from "node:crypto";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseDateInput } from "@/lib/format";
import { isCompanyDocumentKind } from "@/lib/rams/documents";
import { readDocumentFile } from "@/lib/rams/files";
import { redirectWith } from "@/lib/redirects";
import { deletePrivateObject, objectStorageConfigured, putPrivateObject } from "@/lib/storage/object";

async function requireTrader() {
  const user = await getCurrentUser();
  return user?.trader ?? null;
}

function text(formData: FormData, name: string): string {
  return String(formData.get(name) || "");
}

async function storedFile(traderId: string, documentId: string, bytes: Uint8Array, mimeType: string, filename: string) {
  if (objectStorageConfigured()) {
    const key = `company-documents/${traderId}/${documentId}/${randomBytes(8).toString("hex")}`;
    await putPrivateObject(key, bytes, mimeType);
    return { storageKey: key, fileBytes: null, fileName: filename, fileMime: mimeType };
  }
  return { storageKey: "", fileBytes: Buffer.from(bytes), fileName: filename, fileMime: mimeType };
}

export async function saveCompanyDocument(formData: FormData) {
  const trader = await requireTrader();
  if (!trader) redirectWith("/login", "error", "Sign in to continue.");
  const kind = text(formData, "kind");
  const title = text(formData, "title").trim();
  if (!isCompanyDocumentKind(kind)) redirectWith("/documents", "error", "Choose a document type.");
  if (title.length < 2) redirectWith("/documents", "error", "Add a title, for example the policy name or the card.");
  const file = await readDocumentFile(formData);
  if (!file.ok) redirectWith("/documents", "error", file.error);
  const id = text(formData, "documentId");
  const data = {
    kind,
    title: title.slice(0, 160),
    issuer: text(formData, "issuer").trim().slice(0, 160),
    referenceNumber: text(formData, "referenceNumber").trim().slice(0, 80),
    issuedOn: parseDateInput(text(formData, "issuedOn")),
    expiresOn: parseDateInput(text(formData, "expiresOn")),
    notes: text(formData, "notes").trim().slice(0, 2000),
  };
  if (id) {
    const existing = await prisma.companyDocument.findFirst({ where: { id, traderId: trader.id } });
    if (!existing) redirectWith("/documents", "error", "That document could not be found.");
    const next = "empty" in file ? {} : await storedFile(trader.id, existing.id, file.bytes, file.mimeType, file.filename);
    await prisma.companyDocument.update({ where: { id }, data: { ...data, ...next } });
    if (!("empty" in file) && existing.storageKey && existing.storageKey !== ("storageKey" in next ? next.storageKey : "")) {
      await deletePrivateObject(existing.storageKey).catch((error) => console.error("[document file]", error));
    }
    redirectWith("/documents", "notice", "empty" in file ? "Document updated." : "Document updated, and the file is stored privately on your account.");
  }
  const created = await prisma.companyDocument.create({ data: { traderId: trader.id, ...data } });
  if (!("empty" in file)) {
    const next = await storedFile(trader.id, created.id, file.bytes, file.mimeType, file.filename);
    await prisma.companyDocument.update({ where: { id: created.id }, data: next });
  }
  redirectWith("/documents", "notice", "Document saved. Quotestick does not send it to an accreditation scheme.");
}

export async function deleteCompanyFile(formData: FormData) {
  const trader = await requireTrader();
  if (!trader) redirectWith("/login", "error", "Sign in to continue.");
  const id = text(formData, "documentId");
  const existing = await prisma.companyDocument.findFirst({ where: { id, traderId: trader.id } });
  if (!existing) redirectWith("/documents", "error", "That document could not be found.");
  if (existing.storageKey) await deletePrivateObject(existing.storageKey).catch((error) => console.error("[document file]", error));
  await prisma.companyDocument.update({
    where: { id },
    data: { fileName: "", fileMime: "", fileBytes: null, storageKey: "" },
  });
  redirectWith("/documents", "notice", "File removed. The document details are still on your account.");
}

export async function deleteCompanyDocument(formData: FormData) {
  const trader = await requireTrader();
  if (!trader) redirectWith("/login", "error", "Sign in to continue.");
  const id = text(formData, "documentId");
  const existing = await prisma.companyDocument.findFirst({ where: { id, traderId: trader.id } });
  if (existing?.storageKey) await deletePrivateObject(existing.storageKey).catch((error) => console.error("[document file]", error));
  await prisma.companyDocument.deleteMany({ where: { id, traderId: trader.id } });
  redirectWith("/documents", "notice", "Document removed.");
}
