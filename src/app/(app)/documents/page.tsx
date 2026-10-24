import { redirect } from "next/navigation";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { Flash } from "@/components/flash";
import { buttonPrimary, buttonSecondary, inputClass, labelClass } from "@/components/styles";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { dateInputValue, firstParam, formatDate } from "@/lib/format";
import { COMPANY_DOCUMENT_KINDS, companyDocumentLabel, documentExpiry } from "@/lib/rams/documents";
import { deleteCompanyDocument, saveCompanyDocument } from "@/server/document-actions";

export const metadata = { title: "Company documents" };

const expiryCopy = {
  none: "No expiry date",
  ok: "In date",
  due: "Due within 30 days",
  expired: "Expired",
};

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user?.trader) redirect("/onboarding");
  const query = await searchParams;
  const documents = await prisma.companyDocument.findMany({
    where: { traderId: user.trader.id },
    orderBy: [{ kind: "asc" }, { title: "asc" }],
  });
  const now = new Date();

  return (
    <div className="mx-auto grid max-w-2xl gap-5">
      <div>
        <h1 className="font-serif text-4xl">Company documents</h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          Keep insurance, trade cards, training and your health and safety policy in one place, with the dates they run out. RAMS you issue stay on the job. Together they are the pack you would reuse if you later apply to a scheme.
        </p>
      </div>
      <Flash error={firstParam(query.error)} notice={firstParam(query.notice)} />
      <aside className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
        Quotestick stores these for you. It does not fill in CHAS, SafeContractor, SMAS or Constructionline, and it does not say you are accredited. You submit any application yourself.
      </aside>
      {documents.length === 0 ? <p className="card text-sm text-muted">Nothing saved yet.</p> : null}
      {documents.map((document) => {
        const expiry = documentExpiry(document.expiresOn, now);
        return (
          <div key={document.id} className="grid gap-2">
          <form action={saveCompanyDocument} className="card grid gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-serif text-2xl">{document.title}</h2>
              <span className="text-sm font-semibold text-muted">{expiryCopy[expiry]}</span>
            </div>
            <input type="hidden" name="documentId" value={document.id} />
            <label className={labelClass}>
              Type
              <select className={inputClass} name="kind" defaultValue={document.kind}>
                {COMPANY_DOCUMENT_KINDS.map((kind) => (
                  <option key={kind.value} value={kind.value}>
                    {kind.label}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelClass}>
              Title
              <input className={inputClass} name="title" defaultValue={document.title} required />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={labelClass}>
                Issuer
                <input className={inputClass} name="issuer" defaultValue={document.issuer} />
              </label>
              <label className={labelClass}>
                Reference
                <input className={inputClass} name="referenceNumber" defaultValue={document.referenceNumber} />
              </label>
              <label className={labelClass}>
                Issued
                <input className={inputClass} type="date" name="issuedOn" defaultValue={dateInputValue(document.issuedOn)} />
              </label>
              <label className={labelClass}>
                Expires
                <input className={inputClass} type="date" name="expiresOn" defaultValue={dateInputValue(document.expiresOn)} />
              </label>
            </div>
            <label className={labelClass}>
              Notes
              <textarea className={inputClass} name="notes" rows={2} defaultValue={document.notes} />
            </label>
            {document.expiresOn ? <p className="text-sm text-muted">Expires {formatDate(document.expiresOn)}.</p> : null}
            <div className="flex flex-wrap gap-2">
              <button className={buttonPrimary} type="submit">
                Save
              </button>
            </div>
            <p className="text-xs text-muted">{companyDocumentLabel(document.kind)}</p>
          </form>
          <form action={deleteCompanyDocument} className="flex justify-end">
            <input type="hidden" name="documentId" value={document.id} />
            <ConfirmSubmit className={buttonSecondary} label={`Remove ${document.title}`} message="Remove this document from your account?" />
          </form>
          </div>
        );
      })}
      <form action={saveCompanyDocument} className="card grid gap-3">
        <h2 className="font-serif text-2xl">Add a document</h2>
        <label className={labelClass}>
          Type
          <select className={inputClass} name="kind" defaultValue="PUBLIC_LIABILITY">
            {COMPANY_DOCUMENT_KINDS.map((kind) => (
              <option key={kind.value} value={kind.value}>
                {kind.label}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          Title
          <input className={inputClass} name="title" required placeholder="Public liability, Sample Mutual" />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={labelClass}>
            Issuer
            <input className={inputClass} name="issuer" placeholder="Insurer, scheme or college" />
          </label>
          <label className={labelClass}>
            Reference
            <input className={inputClass} name="referenceNumber" placeholder="Policy or card number" />
          </label>
          <label className={labelClass}>
            Issued
            <input className={inputClass} type="date" name="issuedOn" />
          </label>
          <label className={labelClass}>
            Expires
            <input className={inputClass} type="date" name="expiresOn" />
          </label>
        </div>
        <label className={labelClass}>
          Notes
          <textarea className={inputClass} name="notes" rows={2} />
        </label>
        <button className={buttonPrimary} type="submit">
          Save document
        </button>
      </form>
    </div>
  );
}
