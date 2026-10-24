import type { Prisma, PrismaClient } from "@prisma/client";
import type { RamsPdfInput } from "./pdf";
import { invalidateSignaturesOnEdit } from "./sign-store";
import { ramsTradeLabel } from "./library";
import {
  defaultRamsTrade,
  draftRamsBody,
  isRamsTrade,
  type HazardCompleter,
  type RamsBody,
  type RamsTradeValue,
} from "./library";

type Db = PrismaClient | Prisma.TransactionClient;

export const ramsInclude = {
  hazards: { orderBy: { sortOrder: "asc" as const } },
  steps: { orderBy: { sortOrder: "asc" as const } },
  substances: { orderBy: { sortOrder: "asc" as const } },
  permits: { orderBy: { sortOrder: "asc" as const } },
  briefings: { orderBy: { sortOrder: "asc" as const } },
} satisfies Prisma.RamsInclude;

export type RamsRecord = Prisma.RamsGetPayload<{ include: typeof ramsInclude }>;

function clip(value: string | undefined, max: number): string {
  return (value ?? "").trim().slice(0, max);
}

async function nextNumber(db: Db, traderId: string): Promise<string> {
  const updated = await db.trader.update({
    where: { id: traderId },
    data: { ramsSeq: { increment: 1 } },
    select: { ramsSeq: true },
  });
  return `R-${String(updated.ramsSeq).padStart(4, "0")}`;
}

function nestedContent(body: RamsBody) {
  return {
    ppe: body.ppe,
    emergencyNotes: body.emergencyNotes,
    firstAidNotes: body.firstAidNotes,
    welfareNotes: body.welfareNotes,
    hazards: {
      create: body.hazards.map((hazard, index) => ({
        sortOrder: index,
        libraryKey: hazard.libraryKey,
        activity: clip(hazard.activity, 180),
        hazard: clip(hazard.hazard, 500),
        whoHarmed: clip(hazard.whoHarmed, 240),
        likelihoodBefore: hazard.likelihoodBefore,
        severityBefore: hazard.severityBefore,
        controls: clip(hazard.controls, 2000),
        likelihoodAfter: hazard.likelihoodAfter,
        severityAfter: hazard.severityAfter,
      })),
    },
    steps: {
      create: body.steps.map((step, index) => ({ sortOrder: index, detail: clip(step.detail, 2000) })),
    },
    substances: {
      create: body.substances.map((item, index) => ({
        sortOrder: index,
        name: clip(item.name, 160),
        hazard: clip(item.hazard, 500),
        controls: clip(item.controls, 1000),
      })),
    },
    permits: {
      create: body.permits.map((item, index) => ({
        sortOrder: index,
        name: clip(item.name, 120),
        required: item.required,
        detail: clip(item.detail, 500),
      })),
    },
  };
}

export async function createLibraryRams(
  db: Db,
  input: {
    traderId: string;
    jobId?: string | null;
    customerId?: string | null;
    trade?: RamsTradeValue;
    scope?: string;
    title?: string;
    siteAddress?: string;
    sitePostcode?: string;
    clientName?: string;
    clientRole?: string;
    startOn?: Date | null;
    finishOn?: Date | null;
    competentName?: string;
    competentRole?: string;
    competentPhone?: string;
    nearestHospital?: string;
    briefings?: Array<{ operativeName: string; role?: string; phone?: string }>;
    completer?: HazardCompleter | null;
    isTemplate?: boolean;
  },
): Promise<{ id: string; number: string; title: string; source: "library" | "library-and-ai" } | null> {
  const trader = await db.trader.findUnique({ where: { id: input.traderId } });
  if (!trader) return null;

  let job: {
    id: string;
    title: string;
    address: string;
    postcode: string;
    customerId: string;
    bookedAt: Date;
    startedAt: Date | null;
    customer: { name: string };
    quote: { jobDescription: string } | null;
  } | null = null;
  if (input.jobId) {
    job = await db.job.findFirst({
      where: { id: input.jobId, traderId: trader.id },
      include: { customer: { select: { name: true } }, quote: { select: { jobDescription: true } } },
    });
    if (!job) return null;
  }

  let customerId = job?.customerId ?? null;
  if (!customerId && input.customerId) {
    const customer = await db.customer.findFirst({
      where: { id: input.customerId, traderId: trader.id },
      select: { id: true, name: true, address: true, postcode: true },
    });
    if (!customer) return null;
    customerId = customer.id;
    if (!job) {
      input = {
        ...input,
        clientName: input.clientName || customer.name,
        siteAddress: input.siteAddress || customer.address,
        sitePostcode: input.sitePostcode || customer.postcode,
      };
    }
  }

  const trade = input.trade && isRamsTrade(input.trade) ? input.trade : defaultRamsTrade(trader.trade);
  const scope =
    clip(input.scope, 4000) ||
    [job?.title, job?.quote?.jobDescription].filter(Boolean).join(". ");
  const drafted = await draftRamsBody({ trade, scope, completer: input.completer });
  const title = clip(input.title, 160) || (job ? `RAMS for ${job.title}` : `RAMS — ${ramsTradeLabel(trade)}`);
  const number = await nextNumber(db, trader.id);
  const created = await db.rams.create({
    data: {
      traderId: trader.id,
      jobId: job?.id ?? null,
      customerId,
      number,
      title,
      trade,
      isTemplate: Boolean(input.isTemplate),
      siteAddress: clip(input.siteAddress, 240) || job?.address || "",
      sitePostcode: clip(input.sitePostcode, 16) || job?.postcode || "",
      clientName: clip(input.clientName, 160) || job?.customer.name || "",
      clientRole: clip(input.clientRole, 40) || "Client",
      startOn: input.startOn === undefined ? (job?.startedAt ?? job?.bookedAt ?? null) : input.startOn,
      finishOn: input.finishOn ?? null,
      scopeOfWork: scope,
      competentName: clip(input.competentName, 120),
      competentRole: clip(input.competentRole, 80) || "Competent person",
      competentPhone: clip(input.competentPhone, 40) || trader.phone,
      nearestHospital: clip(input.nearestHospital, 240),
      ...nestedContent(drafted.body),
      briefings: {
        create: (input.briefings ?? [])
          .filter((row) => row.operativeName.trim())
          .map((row, index) => ({
            sortOrder: index,
            operativeName: clip(row.operativeName, 120),
            role: clip(row.role, 80),
            phone: clip(row.phone, 40),
          })),
      },
    },
    select: { id: true, number: true, title: true },
  });
  return { ...created, source: drafted.source };
}

export async function cloneRams(
  db: Db,
  input: { traderId: string; sourceId: string; asTemplate: boolean; jobId?: string | null },
): Promise<{ id: string; number: string } | null> {
  const source = await db.rams.findFirst({
    where: { id: input.sourceId, traderId: input.traderId },
    include: ramsInclude,
  });
  if (!source) return null;

  let job: { id: string; title: string; address: string; postcode: string; customerId: string; customer: { name: string } } | null =
    null;
  if (input.jobId && !input.asTemplate) {
    job = await db.job.findFirst({
      where: { id: input.jobId, traderId: input.traderId },
      include: { customer: { select: { name: true } } },
    });
    if (!job) return null;
  }

  const number = await nextNumber(db, input.traderId);
  const title = input.asTemplate
    ? clip(`Template — ${source.title.replace(/^Template — /, "")}`, 160)
    : clip(job ? `RAMS for ${job.title}` : source.title.replace(/^Template — /, ""), 160);
  const created = await db.rams.create({
    data: {
      traderId: input.traderId,
      jobId: input.asTemplate ? null : (job?.id ?? null),
      customerId: input.asTemplate ? null : (job?.customerId ?? null),
      number,
      title,
      status: "DRAFT",
      trade: source.trade,
      isTemplate: input.asTemplate,
      siteAddress: input.asTemplate ? "" : job?.address || source.siteAddress,
      sitePostcode: input.asTemplate ? "" : job?.postcode || source.sitePostcode,
      clientName: input.asTemplate ? "" : job?.customer.name || source.clientName,
      clientRole: source.clientRole,
      startOn: input.asTemplate ? null : new Date(),
      finishOn: null,
      scopeOfWork: source.scopeOfWork,
      competentName: input.asTemplate ? "" : source.competentName,
      competentRole: source.competentRole,
      competentPhone: input.asTemplate ? "" : source.competentPhone,
      signedName: "",
      signedOn: null,
      nearestHospital: input.asTemplate ? "" : source.nearestHospital,
      emergencyNotes: source.emergencyNotes,
      firstAidNotes: source.firstAidNotes,
      welfareNotes: source.welfareNotes,
      ppe: source.ppe,
      hazards: {
        create: source.hazards.map((hazard, index) => ({
          sortOrder: index,
          libraryKey: hazard.libraryKey,
          activity: hazard.activity,
          hazard: hazard.hazard,
          whoHarmed: hazard.whoHarmed,
          likelihoodBefore: hazard.likelihoodBefore,
          severityBefore: hazard.severityBefore,
          controls: hazard.controls,
          likelihoodAfter: hazard.likelihoodAfter,
          severityAfter: hazard.severityAfter,
        })),
      },
      steps: { create: source.steps.map((step, index) => ({ sortOrder: index, detail: step.detail })) },
      substances: {
        create: source.substances.map((item, index) => ({
          sortOrder: index,
          name: item.name,
          hazard: item.hazard,
          controls: item.controls,
        })),
      },
      permits: {
        create: source.permits.map((item, index) => ({
          sortOrder: index,
          name: item.name,
          required: item.required,
          detail: item.detail,
        })),
      },
    },
    select: { id: true, number: true },
  });
  return created;
}

export async function reloadRamsLibrary(
  db: Db,
  input: { traderId: string; ramsId: string; completer?: HazardCompleter | null },
): Promise<{ source: "library" | "library-and-ai"; reset: boolean } | null> {
  const current = await db.rams.findFirst({ where: { id: input.ramsId, traderId: input.traderId } });
  if (!current || !isRamsTrade(current.trade)) return null;
  const drafted = await draftRamsBody({
    trade: current.trade,
    scope: current.scopeOfWork,
    completer: input.completer,
  });
  const content = nestedContent(drafted.body);
  let reset = false;
  const write = async (tx: Db) => {
    await tx.ramsHazard.deleteMany({ where: { ramsId: current.id } });
    await tx.ramsStep.deleteMany({ where: { ramsId: current.id } });
    await tx.ramsSubstance.deleteMany({ where: { ramsId: current.id } });
    await tx.ramsPermit.deleteMany({ where: { ramsId: current.id } });
    await tx.rams.update({
      where: { id: current.id },
      data: {
        ppe: content.ppe,
        emergencyNotes: content.emergencyNotes,
        firstAidNotes: content.firstAidNotes,
        welfareNotes: content.welfareNotes,
        hazards: content.hazards,
        steps: content.steps,
        substances: content.substances,
        permits: content.permits,
      },
    });
    reset = await invalidateSignaturesOnEdit(tx, current.id);
  };
  if ("$transaction" in db) await db.$transaction((tx) => write(tx));
  else await write(db);
  return { source: drafted.source, reset };
}

export function toPdfInput(
  rams: RamsRecord,
  trader: { businessName: string; logoText: string; brandColour: string; phone: string; tradingAddress: string },
): RamsPdfInput {
  return {
    number: rams.number,
    title: rams.title,
    status: rams.status,
    tradeLabel: ramsTradeLabel(rams.trade),
    businessName: trader.businessName,
    logoText: trader.logoText,
    brandColour: trader.brandColour,
    phone: trader.phone,
    tradingAddress: trader.tradingAddress,
    siteAddress: rams.siteAddress,
    sitePostcode: rams.sitePostcode,
    clientName: rams.clientName,
    clientRole: rams.clientRole,
    startOn: rams.startOn,
    finishOn: rams.finishOn,
    scopeOfWork: rams.scopeOfWork,
    competentName: rams.competentName,
    competentRole: rams.competentRole,
    competentPhone: rams.competentPhone,
    signedName: rams.signedName,
    signedOn: rams.signedOn,
    nearestHospital: rams.nearestHospital,
    emergencyNotes: rams.emergencyNotes,
    firstAidNotes: rams.firstAidNotes,
    welfareNotes: rams.welfareNotes,
    ppe: rams.ppe,
    hazards: rams.hazards,
    steps: rams.steps,
    substances: rams.substances,
    permits: rams.permits,
    briefings: rams.briefings,
  };
}
