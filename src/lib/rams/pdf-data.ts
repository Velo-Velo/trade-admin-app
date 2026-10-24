import type { PrismaClient } from "@prisma/client";
import type { RamsPdfInput } from "./pdf";

/** Only signatures for the current version are drawn. Invalidated ones stay in the audit log. */
export async function withCurrentSignatures(db: PrismaClient, ramsId: string, contentVersion: number, input: RamsPdfInput): Promise<RamsPdfInput> {
  const signatures = await db.ramsSignature.findMany({
    where: { ramsId, invalidatedAt: null, contentVersion },
  });
  const approver = signatures.find((signature) => signature.kind === "APPROVER");
  const used = new Set<string>();
  return {
    ...input,
    approverSignaturePng: approver ? Buffer.from(approver.image) : null,
    signedName: approver?.name || input.signedName,
    signedOn: approver?.signedAt ?? input.signedOn,
    briefings: input.briefings.map((row) => {
      const match = signatures.find(
        (signature) =>
          signature.kind === "OPERATIVE" &&
          !used.has(signature.id) &&
          signature.name.trim().toLowerCase() === row.operativeName.trim().toLowerCase(),
      );
      if (!match) return { ...row, signaturePng: null };
      used.add(match.id);
      return { ...row, signaturePng: Buffer.from(match.image), signatureName: match.name, briefedOn: match.signedAt };
    }),
  };
}
