import { randomBytes } from "node:crypto";
import type { Prisma, PrismaClient, RamsSignerKind } from "@prisma/client";
import { editResetsSignatures, isFullySigned, type RequiredSigner, type SignatureRecord } from "./signing";

type Db = PrismaClient | Prisma.TransactionClient;

function token(): string {
  return randomBytes(24).toString("base64url");
}

export async function invalidateSignaturesOnEdit(db: Db, ramsId: string): Promise<boolean> {
  const current = await db.rams.findUnique({
    where: { id: ramsId },
    select: { status: true, contentVersion: true },
  });
  if (!current) return false;
  const validCount = await db.ramsSignature.count({
    where: { ramsId, invalidatedAt: null, contentVersion: current.contentVersion },
  });
  if (!editResetsSignatures({ status: current.status, validCount })) return false;
  const now = new Date();
  await db.ramsSignature.updateMany({
    where: { ramsId, invalidatedAt: null },
    data: { invalidatedAt: now, invalidReason: "The RAMS was edited, so this signature no longer counts." },
  });
  await db.rams.update({
    where: { id: ramsId },
    data: {
      contentVersion: { increment: 1 },
      status: "AWAITING_SIGNATURES",
      signedName: "",
      signedOn: null,
    },
  });
  return true;
}

type DesiredSigner = {
  kind: RamsSignerKind;
  name: string;
  roleLabel: string;
  phone: string;
};

export async function syncSigners(db: Db, ramsId: string): Promise<void> {
  const rams = await db.rams.findUnique({
    where: { id: ramsId },
    include: { briefings: { orderBy: { sortOrder: "asc" } }, signers: true },
  });
  if (!rams) return;
  const desired: DesiredSigner[] = [];
  if (rams.competentName.trim()) {
    desired.push({
      kind: "APPROVER",
      name: rams.competentName.trim(),
      roleLabel: rams.competentRole.trim() || "Competent person",
      phone: rams.competentPhone.trim(),
    });
  }
  for (const briefing of rams.briefings) {
    if (!briefing.operativeName.trim()) continue;
    desired.push({
      kind: "OPERATIVE",
      name: briefing.operativeName.trim(),
      roleLabel: briefing.role.trim() || "Operative",
      phone: briefing.phone.trim(),
    });
  }

  const unused = [...rams.signers];
  const kept = new Set<string>();
  for (const person of desired) {
    const index = unused.findIndex((signer) => signer.kind === person.kind && signer.name.trim().toLowerCase() === person.name.toLowerCase());
    const existing = index >= 0 ? unused.splice(index, 1)[0] : undefined;
    if (existing) {
      kept.add(existing.id);
      await db.ramsSigner.update({
        where: { id: existing.id },
        data: { name: person.name, roleLabel: person.roleLabel, phone: person.phone },
      });
    } else {
      const created = await db.ramsSigner.create({
        data: { ramsId, kind: person.kind, name: person.name, roleLabel: person.roleLabel, phone: person.phone, token: token() },
      });
      kept.add(created.id);
    }
  }
  const removed = unused.filter((signer) => !kept.has(signer.id));
  if (removed.length > 0) {
    const now = new Date();
    await db.ramsSignature.updateMany({
      where: { signerId: { in: removed.map((signer) => signer.id) }, invalidatedAt: null },
      data: { invalidatedAt: now, invalidReason: "This person is no longer on the RAMS, so the signature no longer counts." },
    });
    await db.ramsSigner.deleteMany({ where: { id: { in: removed.map((signer) => signer.id) } } });
  }
}

export async function refreshSignedStatus(db: Db, ramsId: string): Promise<"SIGNED" | "AWAITING_SIGNATURES" | "DRAFT"> {
  const rams = await db.rams.findUnique({
    where: { id: ramsId },
    include: {
      signers: true,
      signatures: { where: { invalidatedAt: null } },
    },
  });
  if (!rams) return "DRAFT";
  const required: RequiredSigner[] = rams.signers.map((signer) => ({
    signerId: signer.id,
    kind: signer.kind,
    name: signer.name,
  }));
  const records: SignatureRecord[] = rams.signatures.map((signature) => ({
    signerId: signature.signerId,
    kind: signature.kind,
    name: signature.name,
    roleLabel: signature.roleLabel,
    signedAt: signature.signedAt,
    contentVersion: signature.contentVersion,
    invalidatedAt: signature.invalidatedAt,
    invalidReason: signature.invalidReason,
  }));
  const full = isFullySigned(required, records, rams.contentVersion);
  const approver = rams.signatures.find(
    (signature) => signature.kind === "APPROVER" && signature.contentVersion === rams.contentVersion && signature.invalidatedAt == null,
  );
  const hasAnyone = rams.signatures.some((signature) => signature.contentVersion === rams.contentVersion);
  let status: "SIGNED" | "AWAITING_SIGNATURES" | "DRAFT" = "DRAFT";
  if (full) status = "SIGNED";
  else if (rams.status === "AWAITING_SIGNATURES" || rams.status === "SIGNED" || rams.status === "ISSUED" || hasAnyone) status = "AWAITING_SIGNATURES";
  await db.rams.update({
    where: { id: ramsId },
    data: {
      status,
      signedName: approver?.name ?? "",
      signedOn: approver?.signedAt ?? null,
    },
  });
  return status;
}

export async function recordSignature(
  db: Db,
  input: { ramsId: string; signerId: string; image: Uint8Array },
): Promise<void> {
  const signer = await db.ramsSigner.findFirst({ where: { id: input.signerId, ramsId: input.ramsId } });
  const rams = await db.rams.findUnique({ where: { id: input.ramsId }, select: { contentVersion: true } });
  if (!signer || !rams) return;
  const now = new Date();
  await db.ramsSignature.updateMany({
    where: { signerId: signer.id, invalidatedAt: null, contentVersion: rams.contentVersion },
    data: { invalidatedAt: now, invalidReason: "Replaced by a later signature on this version." },
  });
  await db.ramsSignature.create({
    data: {
      ramsId: input.ramsId,
      signerId: signer.id,
      kind: signer.kind,
      name: signer.name,
      roleLabel: signer.roleLabel,
      image: Buffer.from(input.image),
      contentVersion: rams.contentVersion,
    },
  });
  await refreshSignedStatus(db, input.ramsId);
}
