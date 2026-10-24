"use server";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requestOrigin } from "@/lib/origin";
import { syncSigners, recordSignature } from "@/lib/rams/sign-store";
import { decodeSignaturePng, signingLinkMessage } from "@/lib/rams/signing";
import { redirectWith } from "@/lib/redirects";
import { sendWhatsAppText, whatsappConfigured } from "@/lib/whatsapp/client";
import { normaliseWhatsAppNumber } from "@/lib/whatsapp/interpret";

async function requireTrader() {
  const user = await getCurrentUser();
  return user?.trader ?? null;
}

function text(formData: FormData, name: string): string {
  return String(formData.get(name) || "");
}

export async function signRamsAs(formData: FormData) {
  const trader = await requireTrader();
  if (!trader) redirectWith("/login", "error", "Sign in to continue.");
  const ramsId = text(formData, "ramsId");
  const signerId = text(formData, "signerId");
  const rams = await prisma.rams.findFirst({ where: { id: ramsId, traderId: trader.id }, select: { id: true, isTemplate: true } });
  if (!rams || rams.isTemplate) redirectWith("/rams", "error", "That RAMS could not be signed.");
  const image = decodeSignaturePng(text(formData, "signaturePng"));
  if (!image) redirectWith(`/rams/${ramsId}`, "error", "Draw your signature in the box, then save it.");
  await prisma.$transaction(async (tx) => {
    await syncSigners(tx, ramsId);
    const signer = await tx.ramsSigner.findFirst({ where: { id: signerId, ramsId } });
    if (!signer) return;
    await recordSignature(tx, { ramsId, signerId: signer.id, image });
  });
  const after = await prisma.rams.findUnique({ where: { id: ramsId }, select: { status: true } });
  if (after?.status === "SIGNED") {
    redirectWith(`/rams/${ramsId}`, "notice", "Fully signed. Everyone named on this version has signed. Nothing has been sent to the client.");
  }
  redirectWith(`/rams/${ramsId}`, "notice", "Signature saved for this version. The RAMS is fully signed only when everyone has signed.");
}

export async function signFromLink(formData: FormData) {
  const token = text(formData, "token");
  const signer = await prisma.ramsSigner.findUnique({ where: { token }, include: { rams: { select: { id: true, isTemplate: true } } } });
  if (!signer || signer.rams.isTemplate) redirectWith("/login", "error", "That signing link is not valid.");
  const image = decodeSignaturePng(text(formData, "signaturePng"));
  if (!image) redirectWith(`/sign/${token}`, "error", "Draw your signature in the box, then save it.");
  await prisma.$transaction(async (tx) => {
    await recordSignature(tx, { ramsId: signer.ramsId, signerId: signer.id, image });
  });
  redirectWith(`/sign/${token}`, "notice", "Signed. Thank you. This counts for the current version of the RAMS.");
}

export async function sendSigningLinks(formData: FormData) {
  const trader = await requireTrader();
  if (!trader) redirectWith("/login", "error", "Sign in to continue.");
  const ramsId = text(formData, "ramsId");
  const again = text(formData, "again") === "1";
  const rams = await prisma.rams.findFirst({ where: { id: ramsId, traderId: trader.id } });
  if (!rams || rams.isTemplate) redirectWith("/rams", "error", "That RAMS could not be found.");
  if (rams.competentName.trim().length < 2) {
    redirectWith(`/rams/${ramsId}`, "error", "Add the competent person before you send it for signatures.");
  }
  await prisma.$transaction(async (tx) => {
    await syncSigners(tx, ramsId);
    if (rams.status === "DRAFT") {
      await tx.rams.update({ where: { id: ramsId }, data: { status: "AWAITING_SIGNATURES" } });
    }
  });
  const signers = await prisma.ramsSigner.findMany({ where: { ramsId }, orderBy: { kind: "asc" } });
  if (signers.length === 0) {
    redirectWith(`/rams/${ramsId}`, "error", "Add the competent person, and the operatives who will do the work.");
  }
  const origin = await requestOrigin();
  const lines: string[] = [];
  for (const signer of signers) {
    const url = `${origin}/sign/${signer.token}`;
    const body = signingLinkMessage({
      businessName: trader.businessName,
      number: rams.number,
      personName: signer.name,
      url,
      again,
    });
    lines.push(body);
    if (trader.whatsappE164) {
      await prisma.whatsAppMessage.create({
        data: { phone: trader.whatsappE164, traderId: trader.id, direction: "out", body },
      });
    }
    const mobile = normaliseWhatsAppNumber(signer.phone);
    if (mobile && whatsappConfigured()) {
      try {
        await sendWhatsAppText(mobile, body);
      } catch (error) {
        console.error("[rams sign link]", error);
      }
    }
  }
  const where = trader.whatsappE164
    ? "The signing links are in WhatsApp, one for each person. Forward them. Nothing was sent to the customer."
    : "Copy each signing link below. No WhatsApp number is linked on this account.";
  redirectWith(`/rams/${ramsId}`, "notice", again ? `Everyone needs to sign again. ${where}` : where);
}
