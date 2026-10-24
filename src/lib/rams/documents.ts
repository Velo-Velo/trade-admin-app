/**
 * Company documents sit beside RAMS so a later accreditation pack can reuse both.
 * Insurance, trade cards, training records and the health and safety policy are stored once,
 * with expiry dates a pack can flag. Issued RAMS stay on the job that produced them.
 * This build does not fill CHAS, SafeContractor, SMAS or Constructionline forms,
 * does not upload evidence to a scheme, and does not say the business is accredited.
 * File copies can be added later the same way job photos are stored. The fields a form
 * asks for (issuer, reference, issued on, expires on) are already here.
 */

export const COMPANY_DOCUMENT_KINDS = [
  { value: "PUBLIC_LIABILITY", label: "Public liability insurance" },
  { value: "EMPLOYERS_LIABILITY", label: "Employers' liability insurance" },
  { value: "TRADE_CARD", label: "Trade card" },
  { value: "TRAINING", label: "Training record" },
  { value: "SAFETY_POLICY", label: "Health and safety policy" },
  { value: "OTHER", label: "Other" },
] as const;

export type CompanyDocumentKindValue = (typeof COMPANY_DOCUMENT_KINDS)[number]["value"];

export function isCompanyDocumentKind(value: string): value is CompanyDocumentKindValue {
  return COMPANY_DOCUMENT_KINDS.some((item) => item.value === value);
}

export function companyDocumentLabel(kind: string): string {
  return COMPANY_DOCUMENT_KINDS.find((item) => item.value === kind)?.label ?? "Document";
}

const DAY = 24 * 60 * 60 * 1000;

export type DocumentExpiry = "none" | "ok" | "due" | "expired";

/** Due means the date falls inside the next 30 days, including today. */
export function documentExpiry(expiresOn: Date | null, now: Date): DocumentExpiry {
  if (!expiresOn) return "none";
  const end = new Date(expiresOn);
  end.setUTCHours(0, 0, 0, 0);
  const today = new Date(now);
  today.setUTCHours(0, 0, 0, 0);
  const diff = end.getTime() - today.getTime();
  if (diff < 0) return "expired";
  if (diff <= 30 * DAY) return "due";
  return "ok";
}
