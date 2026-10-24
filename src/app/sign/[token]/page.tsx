import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DemoBanner } from "@/components/demo-banner";
import { Flash } from "@/components/flash";
import { SignaturePad } from "@/components/signature-pad";
import { buttonPrimary } from "@/components/styles";
import { prisma } from "@/lib/db";
import { isDemoSlug } from "@/lib/demo";
import { firstParam, formatDate } from "@/lib/format";
import { RAMS_DISCLAIMER } from "@/lib/rams/disclaimer";
import { ramsTradeLabel } from "@/lib/rams/library";
import { riskBand, riskScore } from "@/lib/rams/risk";
import { ramsInclude } from "@/lib/rams/store";
import { signFromLink } from "@/server/signature-actions";

export const metadata: Metadata = {
  title: "Sign a RAMS",
  robots: { index: false, follow: false },
};

export default async function SignRamsPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const { token } = await params;
  const query = await searchParams;
  const signer = await prisma.ramsSigner.findUnique({
    where: { token },
    include: {
      rams: {
        include: {
          ...ramsInclude,
          trader: { select: { businessName: true, slug: true, phone: true } },
          signatures: {
            where: { invalidatedAt: null },
            select: { id: true, signerId: true, contentVersion: true, signedAt: true },
          },
        },
      },
    },
  });
  if (!signer || signer.rams.isTemplate) notFound();
  const rams = signer.rams;
  const mine = rams.signatures.find((signature) => signature.signerId === signer.id && signature.contentVersion === rams.contentVersion);

  return (
    <div className="min-h-screen">
      {isDemoSlug(rams.trader.slug) ? <DemoBanner kind="sample" /> : null}
      <main id="main" className="mx-auto grid max-w-2xl gap-5 px-4 py-6">
        <header>
          <p className="text-sm font-semibold text-muted">
            {rams.trader.businessName} · {rams.number} · {ramsTradeLabel(rams.trade)}
          </p>
          <h1 className="font-serif text-4xl">{rams.title}</h1>
          <p className="mt-2 text-sm text-muted">For {signer.name}. Version {rams.contentVersion}. No account is needed to sign.</p>
        </header>
        <Flash error={firstParam(query.error)} notice={firstParam(query.notice)} />
        <aside className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">{RAMS_DISCLAIMER}</aside>
        <section className="card grid gap-2 text-sm leading-6">
          <p>
            <span className="font-semibold">Site. </span>
            {[rams.siteAddress, rams.sitePostcode].filter(Boolean).join(", ") || "Not written in"}
          </p>
          <p>
            <span className="font-semibold">Scope. </span>
            {rams.scopeOfWork || "Not written in"}
          </p>
          <p>
            <span className="font-semibold">Nearest A&E. </span>
            {rams.nearestHospital || "Not filled in."} Check this is the right 24-hour A&E before work starts.
          </p>
        </section>
        <section className="grid gap-3">
          <h2 className="font-serif text-2xl">Hazards</h2>
          {rams.hazards.map((hazard) => {
            const after = riskBand(riskScore(hazard.likelihoodAfter, hazard.severityAfter));
            return (
              <article key={hazard.id} className="card text-sm leading-6">
                <p className="font-semibold">{hazard.activity}</p>
                <p>{hazard.hazard}</p>
                <p className="text-muted">Who might be harmed: {hazard.whoHarmed}</p>
                <p>After controls: {after.label}. {hazard.controls}</p>
              </article>
            );
          })}
        </section>
        <section className="card text-sm leading-6">
          <h2 className="font-serif text-2xl">Method</h2>
          <ol className="mt-2 grid gap-2">
            {rams.steps.map((step, index) => (
              <li key={step.id}>
                {index + 1}. {step.detail}
              </li>
            ))}
          </ol>
        </section>
        <section className="card grid gap-3">
          <h2 className="font-serif text-2xl">Your signature</h2>
          {mine ? (
            <p className="text-sm leading-6">You signed this version on {formatDate(mine.signedAt)}. If the RAMS changes, this link will ask you to sign again.</p>
          ) : (
            <form action={signFromLink} className="grid gap-3">
              <input type="hidden" name="token" value={signer.token} />
              <p className="text-sm leading-6">
                {signer.name}, draw your signature below. You are confirming you have read this version and will stop if the site is different.
              </p>
              <SignaturePad />
              <button className={buttonPrimary} type="submit">
                Sign {rams.number}
              </button>
            </form>
          )}
        </section>
      </main>
    </div>
  );
}
