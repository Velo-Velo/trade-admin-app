"use server";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseDateInput } from "@/lib/format";
import { isCompanyDocumentKind } from "@/lib/rams/documents";
import { redirectWith } from "@/lib/redirects";

async function requireTrader() {
  const user = await getCurrentUser();
  return user?.trader ?? null;
}

function text(formData: FormData, name: string): string {
  return String(formData.get(name) || "");
}

export async function saveCompanyDocument(formData: FormData) {
  const trader = await requireTrader();
  if (!trader) redirectWith("/login", "error", "Sign in to continue.");
  const kind = text(formData, "kind");
  const title = text(formData, "title").trim();
  if (!isCompanyDocumentKind(kind)) redirectWith("/documents", "error", "Choose a document type.");
  if (title.length < 2) redirectWith("/documents", "error", "Add a title, for example the policy name or the card.");
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
    await prisma.companyDocument.update({ where: { id }, data });
    redirectWith("/documents", "notice", "Document updated. It stays on your account for you to reuse.");
  }
  await prisma.companyDocument.create({ data: { traderId: trader.id, ...data } });
  redirectWith("/documents", "notice", "Document saved. Quotestick does not send it to an accreditation scheme.");
}

export async function deleteCompanyDocument(formData: FormData) {
  const trader = await requireTrader();
  if (!trader) redirectWith("/login", "error", "Sign in to continue.");
  const id = text(formData, "documentId");
  await prisma.companyDocument.deleteMany({ where: { id, traderId: trader.id } });
  redirectWith("/documents", "notice", "Document removed.");
}
