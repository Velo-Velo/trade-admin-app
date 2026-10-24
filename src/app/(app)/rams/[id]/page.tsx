import { notFound, redirect } from "next/navigation";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { Flash } from "@/components/flash";
import { RiskPair } from "@/components/risk-pair";
import { buttonPrimary, buttonSecondary, inputClass, labelClass } from "@/components/styles";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { dateInputValue, firstParam } from "@/lib/format";
import { RAMS_DISCLAIMER } from "@/lib/rams/disclaimer";
import { RAMS_TRADES, ramsTradeLabel } from "@/lib/rams/library";
import { RISK_KEY, riskBand, riskBandTone, riskScore } from "@/lib/rams/risk";
import { ramsInclude } from "@/lib/rams/store";
import {
  addRamsHazard,
  addRamsSubstance,
  deleteRams,
  deleteRamsHazard,
  reloadRamsFromLibrary,
  saveRamsArrangements,
  saveRamsAsTemplate,
  saveRamsBriefing,
  saveRamsDetails,
  saveRamsHazards,
  saveRamsMethod,
  saveRamsSubstances,
} from "@/server/rams-actions";

export const metadata = { title: "RAMS" };

const jumps = [
  ["#details", "Details"],
  ["#hazards", "Hazards"],
  ["#method", "Method"],
  ["#arrangements", "Arrangements"],
  ["#sign-off", "Sign-off"],
  ["#coshh", "COSHH"],
];

export default async function RamsEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user?.trader) redirect("/onboarding");
  const { id } = await params;
  const query = await searchParams;
  const rams = await prisma.rams.findFirst({
    where: { id, traderId: user.trader.id },
    include: {
      ...ramsInclude,
      job: { select: { id: true, title: true } },
      customer: { select: { id: true, name: true } },
    },
  });
  if (!rams) notFound();
  const highest = rams.hazards.reduce((max, hazard) => {
    return Math.max(max, riskScore(hazard.likelihoodAfter, hazard.severityAfter));
  }, 0);

  return (
    <div className="mx-auto grid max-w-3xl gap-5">
      <div>
        <p className="text-sm font-semibold text-muted">
          {rams.number} · {ramsTradeLabel(rams.trade)} · {rams.isTemplate ? "Template" : rams.status === "ISSUED" ? "Checked" : "Draft"}
        </p>
        <h1 className="font-serif text-4xl">{rams.title}</h1>
        <p className="mt-2 text-sm text-muted">
          {rams.job ? <a href={`/jobs/${rams.job.id}`}>{rams.job.title}</a> : "Not stored on a job"}
          {rams.customer ? (
            <>
              {" "}
              · <a href={`/customers/${rams.customer.id}`}>{rams.clientName || rams.customer.name}</a>
            </>
          ) : rams.clientName ? (
            ` · ${rams.clientName}`
          ) : null}
          {highest > 0 ? ` · highest residual score ${highest} (${riskBand(highest).label})` : ""}
        </p>
      </div>
      <Flash error={firstParam(query.error)} notice={firstParam(query.notice)} />
      <aside className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">{RAMS_DISCLAIMER}</aside>
      {rams.isTemplate ? (
        <p className="card text-sm leading-6">
          This is a template. It is not tied to a job. Start a new RAMS and pick it to copy the wording onto a job. The copy is the one you sign.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {jumps.map(([href, label]) => (
          <a key={href} href={href} className="rounded-full bg-white px-3 py-2 text-sm font-semibold text-ink no-underline ring-1 ring-sand">
            {label}
          </a>
        ))}
        <a href={`/api/rams/${rams.id}/pdf`} className={buttonPrimary} target="_blank" rel="noreferrer">
          Download PDF
        </a>
      </div>
      <div className="flex flex-wrap gap-2">
        <form action={reloadRamsFromLibrary}>
          <input type="hidden" name="ramsId" value={rams.id} />
          <button className={buttonSecondary} type="submit">
            Reload library
          </button>
        </form>
        {rams.isTemplate ? null : (
          <form action={saveRamsAsTemplate}>
            <input type="hidden" name="ramsId" value={rams.id} />
            <button className={buttonSecondary} type="submit">
              Save as template
            </button>
          </form>
        )}
        <form action={deleteRams}>
          <input type="hidden" name="ramsId" value={rams.id} />
          <ConfirmSubmit className={buttonSecondary} label="Delete" message="Delete this RAMS? This cannot be undone." />
        </form>
      </div>

      <form id="details" action={saveRamsDetails} className="card grid gap-3">
        <h2 className="font-serif text-2xl">Job details</h2>
        <input type="hidden" name="ramsId" value={rams.id} />
        <label className={labelClass}>
          Title
          <input className={inputClass} name="title" defaultValue={rams.title} required />
        </label>
        <label className={labelClass}>
          Trade
          <select className={inputClass} name="trade" defaultValue={rams.trade}>
            {RAMS_TRADES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <span className="font-normal text-muted">Saving a new trade does not rewrite the hazards. Use Reload library after you save.</span>
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={labelClass}>
            Site address
            <input className={inputClass} name="siteAddress" defaultValue={rams.siteAddress} />
          </label>
          <label className={labelClass}>
            Postcode
            <input className={inputClass} name="sitePostcode" defaultValue={rams.sitePostcode} />
          </label>
          <label className={labelClass}>
            Client or main contractor
            <input className={inputClass} name="clientName" defaultValue={rams.clientName} />
          </label>
          <label className={labelClass}>
            They are the
            <select className={inputClass} name="clientRole" defaultValue={rams.clientRole}>
              <option>Client</option>
              <option>Domestic client</option>
              <option>Main contractor</option>
            </select>
          </label>
          <label className={labelClass}>
            Start
            <input className={inputClass} type="date" name="startOn" defaultValue={dateInputValue(rams.startOn)} />
          </label>
          <label className={labelClass}>
            Finish
            <input className={inputClass} type="date" name="finishOn" defaultValue={dateInputValue(rams.finishOn)} />
          </label>
        </div>
        <label className={labelClass}>
          Scope of work
          <textarea className={inputClass} name="scopeOfWork" rows={4} defaultValue={rams.scopeOfWork} />
        </label>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className={labelClass}>
            Competent person
            <input className={inputClass} name="competentName" defaultValue={rams.competentName} />
          </label>
          <label className={labelClass}>
            Role
            <input className={inputClass} name="competentRole" defaultValue={rams.competentRole} />
          </label>
          <label className={labelClass}>
            Phone
            <input className={inputClass} name="competentPhone" defaultValue={rams.competentPhone} />
          </label>
        </div>
        <button className={`${buttonPrimary} w-full sm:w-auto`} type="submit">
          Save details
        </button>
      </form>

      <section id="hazards" className="grid gap-3">
        <form id="save-hazards" action={saveRamsHazards}>
          <input type="hidden" name="ramsId" value={rams.id} />
        </form>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-serif text-2xl">Hazards</h2>
            <p className="mt-1 text-sm leading-6 text-muted">{RISK_KEY}</p>
          </div>
          <button className={buttonPrimary} type="submit" form="save-hazards">
            Save risk assessment
          </button>
        </div>
        {rams.hazards.map((hazard, index) => {
          const before = riskBand(riskScore(hazard.likelihoodBefore, hazard.severityBefore));
          const after = riskBand(riskScore(hazard.likelihoodAfter, hazard.severityAfter));
          return (
            <article key={hazard.id} className="card grid gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-muted">Hazard {index + 1}</p>
                <p className="flex flex-wrap gap-2 text-xs font-semibold">
                  <span className={`rounded-full px-2 py-1 ${riskBandTone(before.label)}`}>Before {before.label}</span>
                  <span className={`rounded-full px-2 py-1 ${riskBandTone(after.label)}`}>After {after.label}</span>
                  {hazard.libraryKey ? <span className="rounded-full bg-sand px-2 py-1">Library</span> : <span className="rounded-full bg-sand px-2 py-1">Added by you</span>}
                </p>
              </div>
              <input form="save-hazards" type="hidden" name="libraryKey" value={hazard.libraryKey} />
              <label className={labelClass}>
                Task
                <input form="save-hazards" className={inputClass} name="activity" defaultValue={hazard.activity} />
              </label>
              <label className={labelClass}>
                Hazard
                <textarea form="save-hazards" className={inputClass} name="hazard" rows={2} defaultValue={hazard.hazard} />
              </label>
              <label className={labelClass}>
                Who might be harmed
                <input form="save-hazards" className={inputClass} name="whoHarmed" defaultValue={hazard.whoHarmed} />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <RiskPair
                  form="save-hazards"
                  legend="Before controls"
                  likelihoodName="likelihoodBefore"
                  severityName="severityBefore"
                  likelihood={hazard.likelihoodBefore}
                  severity={hazard.severityBefore}
                />
                <RiskPair
                  form="save-hazards"
                  legend="After controls"
                  likelihoodName="likelihoodAfter"
                  severityName="severityAfter"
                  likelihood={hazard.likelihoodAfter}
                  severity={hazard.severityAfter}
                />
              </div>
              <label className={labelClass}>
                Control measures
                <textarea form="save-hazards" className={inputClass} name="controls" rows={3} defaultValue={hazard.controls} />
              </label>
              <form action={deleteRamsHazard}>
                <input type="hidden" name="ramsId" value={rams.id} />
                <input type="hidden" name="hazardId" value={hazard.id} />
                <button className={buttonSecondary} type="submit">
                  Remove this hazard
                </button>
              </form>
            </article>
          );
        })}
        <div className="flex flex-wrap gap-2">
          <button className={buttonPrimary} type="submit" form="save-hazards">
            Save risk assessment
          </button>
          <form action={addRamsHazard}>
            <input type="hidden" name="ramsId" value={rams.id} />
            <button className={buttonSecondary} type="submit">
              Add a hazard
            </button>
          </form>
        </div>
      </section>

      <form id="method" action={saveRamsMethod} className="card grid gap-3">
        <h2 className="font-serif text-2xl">Method statement</h2>
        <p className="text-sm leading-6 text-muted">One step on each line. The PDF numbers them.</p>
        <input type="hidden" name="ramsId" value={rams.id} />
        <textarea className={inputClass} name="method" rows={12} defaultValue={rams.steps.map((step) => step.detail).join("\n")} />
        <button className={`${buttonPrimary} w-full sm:w-auto`} type="submit">
          Save method
        </button>
      </form>

      <form id="arrangements" action={saveRamsArrangements} className="card grid gap-3">
        <h2 className="font-serif text-2xl">Arrangements</h2>
        <input type="hidden" name="ramsId" value={rams.id} />
        <label className={labelClass}>
          Nearest A&E
          <input className={inputClass} name="nearestHospital" defaultValue={rams.nearestHospital} placeholder="Name the hospital for this site" />
        </label>
        <label className={labelClass}>
          PPE
          <textarea className={inputClass} name="ppe" rows={4} defaultValue={rams.ppe} />
        </label>
        <div className="grid gap-3">
          <h3 className="font-semibold">Permits</h3>
          {rams.permits.map((permit) => (
            <fieldset key={permit.id} className="grid gap-2 rounded-md border border-sand p-3">
              <input type="hidden" name="permitId" value={permit.id} />
              <label className="flex items-start gap-2 text-sm font-semibold">
                <input type="checkbox" name="permitOn" value={permit.id} defaultChecked={permit.required} />
                {permit.name} required
              </label>
              <textarea className={inputClass} name="permitDetail" rows={2} defaultValue={permit.detail} />
            </fieldset>
          ))}
        </div>
        <label className={labelClass}>
          Emergency
          <textarea className={inputClass} name="emergencyNotes" rows={5} defaultValue={rams.emergencyNotes} />
        </label>
        <label className={labelClass}>
          First aid
          <textarea className={inputClass} name="firstAidNotes" rows={4} defaultValue={rams.firstAidNotes} />
        </label>
        <label className={labelClass}>
          Welfare
          <textarea className={inputClass} name="welfareNotes" rows={4} defaultValue={rams.welfareNotes} />
        </label>
        <button className={`${buttonPrimary} w-full sm:w-auto`} type="submit">
          Save arrangements
        </button>
      </form>

      <section id="sign-off" className="card grid gap-4">
        <div>
          <h2 className="font-serif text-2xl">Sign-off and briefing</h2>
          <p className="mt-1 text-sm leading-6 text-muted">
            Your name is the competent-person sign-off. The sheet below is for the people who will do the work. Marking it checked does not send it to anyone.
          </p>
        </div>
        <form id="save-briefing" action={saveRamsBriefing} className="grid gap-3">
          <input type="hidden" name="ramsId" value={rams.id} />
          <label className={labelClass}>
            Signed by
            <input className={inputClass} name="signedName" defaultValue={rams.signedName} placeholder="Type your name" />
          </label>
        </form>
        {rams.briefings.map((briefing) => (
          <article key={briefing.id} className="grid gap-2 rounded-md border border-sand p-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={labelClass}>
                Operative
                <input form="save-briefing" className={inputClass} name="operativeName" defaultValue={briefing.operativeName} />
              </label>
              <label className={labelClass}>
                Role
                <input form="save-briefing" className={inputClass} name="operativeRole" defaultValue={briefing.role} />
              </label>
              <label className={labelClass}>
                Briefed on
                <input form="save-briefing" className={inputClass} type="date" name="briefedOn" defaultValue={dateInputValue(briefing.briefedOn)} />
              </label>
              <label className={labelClass}>
                Signature
                <input form="save-briefing" className={inputClass} name="operativeSignature" defaultValue={briefing.signatureName} placeholder="Their name" />
              </label>
            </div>
          </article>
        ))}
        <article className="grid gap-2 rounded-md border border-dashed border-sand p-3">
          <p className="text-sm font-semibold">Add someone to the briefing</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={labelClass}>
              Operative
              <input form="save-briefing" className={inputClass} name="operativeName" placeholder="Name" />
            </label>
            <label className={labelClass}>
              Role
              <input form="save-briefing" className={inputClass} name="operativeRole" placeholder="Operative" />
            </label>
            <label className={labelClass}>
              Briefed on
              <input form="save-briefing" className={inputClass} type="date" name="briefedOn" />
            </label>
            <label className={labelClass}>
              Signature
              <input form="save-briefing" className={inputClass} name="operativeSignature" placeholder="Their name, when they have signed" />
            </label>
          </div>
        </article>
        <div className="flex flex-wrap gap-2">
          <button className={buttonSecondary} type="submit" form="save-briefing" name="intent" value="save">
            Save sign-off
          </button>
          <button className={buttonPrimary} type="submit" form="save-briefing" name="intent" value="issue">
            Mark as checked
          </button>
          {rams.status === "ISSUED" ? (
            <button className={buttonSecondary} type="submit" form="save-briefing" name="intent" value="draft">
              Back to draft
            </button>
          ) : null}
        </div>
      </section>

      <section id="coshh" className="grid gap-3">
        <h2 className="font-serif text-2xl">COSHH</h2>
        <form id="save-substances" action={saveRamsSubstances}>
          <input type="hidden" name="ramsId" value={rams.id} />
        </form>
        {rams.substances.map((substance) => (
          <article key={substance.id} className="card grid gap-2">
            <label className={labelClass}>
              Substance
              <input form="save-substances" className={inputClass} name="substanceName" defaultValue={substance.name} />
            </label>
            <label className={labelClass}>
              Harm
              <textarea form="save-substances" className={inputClass} name="substanceHazard" rows={2} defaultValue={substance.hazard} />
            </label>
            <label className={labelClass}>
              Controls
              <textarea form="save-substances" className={inputClass} name="substanceControls" rows={2} defaultValue={substance.controls} />
            </label>
          </article>
        ))}
        <article className="card grid gap-2">
          <p className="text-sm font-semibold">Add a substance</p>
          <input form="save-substances" className={inputClass} name="substanceName" placeholder="Product name" />
          <textarea form="save-substances" className={inputClass} name="substanceHazard" rows={2} placeholder="Harm" />
          <textarea form="save-substances" className={inputClass} name="substanceControls" rows={2} placeholder="Controls from the label" />
        </article>
        <div className="flex flex-wrap gap-2">
          <button className={buttonPrimary} type="submit" form="save-substances">
            Save COSHH
          </button>
          <form action={addRamsSubstance}>
            <input type="hidden" name="ramsId" value={rams.id} />
            <button className={buttonSecondary} type="submit">
              Add a blank row
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
