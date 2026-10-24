export type SignerKind = "APPROVER" | "OPERATIVE";

export type SignatureRecord = {
  signerId: string | null;
  kind: SignerKind;
  name: string;
  roleLabel: string;
  signedAt: Date;
  contentVersion: number;
  invalidatedAt: Date | null;
  invalidReason: string;
  image?: Uint8Array | null;
};

export type RequiredSigner = {
  signerId: string;
  kind: SignerKind;
  name: string;
};

export const INVALID_REASON = "The RAMS was edited, so this signature no longer counts.";

export function validSignatures(records: SignatureRecord[], contentVersion: number): SignatureRecord[] {
  return records.filter((record) => record.invalidatedAt == null && record.contentVersion === contentVersion);
}

/** Fully signed only when the approver and every operative have signed this version. */
export function isFullySigned(required: RequiredSigner[], records: SignatureRecord[], contentVersion: number): boolean {
  if (required.length === 0) return false;
  if (!required.some((person) => person.kind === "APPROVER")) return false;
  const current = validSignatures(records, contentVersion);
  return required.every((person) => current.some((record) => record.signerId === person.signerId));
}

/** Any edit after someone has signed, or after the RAMS was fully signed, clears every signature. */
export function editResetsSignatures(input: { status: string; validCount: number }): boolean {
  return input.validCount > 0 || input.status === "SIGNED" || input.status === "ISSUED";
}

export function signaturesAfterEdit(records: SignatureRecord[], now: Date): SignatureRecord[] {
  return records.map((record) =>
    record.invalidatedAt
      ? record
      : { ...record, invalidatedAt: now, invalidReason: INVALID_REASON },
  );
}

export function signaturesForPdf(records: SignatureRecord[], contentVersion: number): SignatureRecord[] {
  return validSignatures(records, contentVersion).filter((record) => record.image && record.image.byteLength > 32);
}

export function signingLinkMessage(input: {
  businessName: string;
  number: string;
  personName: string;
  url: string;
  again: boolean;
}): string {
  const lead = input.again
    ? `${input.businessName} changed RAMS ${input.number}. The old signatures no longer count, so ${input.personName} needs to sign the current version.`
    : `${input.businessName} needs ${input.personName} to sign RAMS ${input.number}.`;
  return [
    lead,
    `Sign on your phone: ${input.url}`,
    "Read it first and check it suits the site. It is a drafting aid, not health and safety advice.",
    "Nothing is sent to the customer.",
  ].join("\n");
}

export function ramsStatusLabel(status: string): string {
  if (status === "AWAITING_SIGNATURES") return "Awaiting signatures";
  if (status === "SIGNED" || status === "ISSUED") return "Fully signed";
  return "Draft";
}

export function decodeSignaturePng(value: string): Uint8Array | null {
  const match = /^data:image\/png;base64,([A-Za-z0-9+/=\s]+)$/.exec(value.trim());
  if (!match) return null;
  const bytes = Buffer.from(match[1].replace(/\s/g, ""), "base64");
  if (bytes.length < 40 || bytes.length > 500_000) return null;
  if (bytes[0] !== 0x89 || bytes[1] !== 0x50 || bytes[2] !== 0x4e || bytes[3] !== 0x47) return null;
  return bytes;
}
