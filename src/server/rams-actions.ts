"use server";

import { getCurrentUser } from "@/lib/auth";
import { parseDateInput } from "@/lib/format";
import { prisma } from "@/lib/db";
import { redirectWith } from "@/lib/redirects";
import { ramsCompleterFromEnv } from "@/lib/rams/assist";
import { isRamsTrade, type RamsTradeValue } from "@/lib/rams/library";
import { parseRamsTrade } from "@/lib/rams/match";
import { fillNearestHospital } from "@/lib/rams/nearest";
import { invalidateSignaturesOnEdit, refreshSignedStatus, syncSigners } from "@/lib/rams/sign-store";
import { cloneRams, createLibraryRams, reloadRamsLibrary } from "@/lib/rams/store";
import { clampScorePart } from "@/lib/rams/risk";

async function requireTrader() {
  const user = await getCurrentUser();
  return user?.trader ?? null;
}

function text(formData: FormData, name: string): string {
  return String(formData.get(name) || "");
}

function column(formData: FormData, name: string): string[] {
  return formData.getAll(name).map((value) => String(value));
}

function back(ramsId: string): string {
  return `/rams/${ramsId}`;
}

function saved(ramsId: string, reset: boolean, notice: string): never {
  if (reset) {
    redirectWith(
      `${back(ramsId)}?resign=1`,
      "notice",
      "Saved. The RAMS changed, so every signature was cleared. It is awaiting signatures again. Send the signing links to everyone.",
    );
  }
  redirectWith(back(ramsId), "notice", notice);
}

export async function createRams(formData: FormData) {
  const trader = await requireTrader();
  if (!trader) redirectWith("/login", "error", "Sign in to continue.");
  const jobId = text(formData, "jobId");
  const customerId = text(formData, "customerId");
  const templateId = text(formData, "templateId");
  const trade = parseRamsTrade(text(formData, "trade"), "GENERAL_BUILDING") as RamsTradeValue;
  const returnJob = text(formData, "returnJob");

  if (templateId) {
    const cloned = await cloneRams(prisma, {
      traderId: trader.id,
      sourceId: templateId,
      asTemplate: false,
      jobId: jobId || null,
    });
    if (!cloned) {
      redirectWith(returnJob ? `/jobs/${returnJob}` : "/rams/new", "error", "That template could not be used.");
    }
    redirectWith(`/rams/${cloned.id}`, "notice", `${cloned.number} is a copy of your template. Check the site details before you send it.`);
  }

  const created = await createLibraryRams(prisma, {
    traderId: trader.id,
    jobId: jobId || null,
    customerId: customerId || null,
    trade: isRamsTrade(text(formData, "trade")) ? trade : undefined,
    scope: text(formData, "scope"),
    title: text(formData, "title"),
    siteAddress: text(formData, "siteAddress"),
    sitePostcode: text(formData, "sitePostcode"),
    clientName: text(formData, "clientName"),
    clientRole: text(formData, "clientRole"),
    startOn: text(formData, "startOn") ? parseDateInput(text(formData, "startOn")) : undefined,
    finishOn: text(formData, "finishOn") ? parseDateInput(text(formData, "finishOn")) : undefined,
    completer: ramsCompleterFromEnv(),
  });
  if (!created) {
    redirectWith(returnJob ? `/jobs/${returnJob}` : "/rams/new", "error", "That RAMS could not be started. Check the job is yours.");
  }
  await fillNearestHospital(prisma, created.id);
  const how =
    created.source === "library-and-ai"
      ? `${created.number} is ready. AI only chose hazards from the checked library. Check it suits this site. Nothing has been sent.`
      : `${created.number} is ready from the checked library. Check it suits this site. Nothing has been sent.`;
  redirectWith(`/rams/${created.id}`, "notice", how);
}

export async function saveRamsDetails(formData: FormData) {
  const trader = await requireTrader();
  if (!trader) redirectWith("/login", "error", "Sign in to continue.");
  const id = text(formData, "ramsId");
  const current = await prisma.rams.findFirst({ where: { id, traderId: trader.id } });
  if (!current) redirectWith("/rams", "error", "That RAMS could not be found.");
  const trade = text(formData, "trade");
  if (!isRamsTrade(trade)) redirectWith(back(id), "error", "Choose a trade from the list.");
  const reset = await prisma.$transaction(async (tx) => {
    await tx.rams.update({
      where: { id },
      data: {
        title: text(formData, "title").trim().slice(0, 160) || current.title,
        trade,
        siteAddress: text(formData, "siteAddress").trim().slice(0, 240),
        sitePostcode: text(formData, "sitePostcode").trim().slice(0, 16),
        clientName: text(formData, "clientName").trim().slice(0, 160),
        clientRole: text(formData, "clientRole").trim().slice(0, 40) || "Client",
        startOn: parseDateInput(text(formData, "startOn")),
        finishOn: parseDateInput(text(formData, "finishOn")),
        scopeOfWork: text(formData, "scopeOfWork").trim().slice(0, 4000),
        competentName: text(formData, "competentName").trim().slice(0, 120),
        competentRole: text(formData, "competentRole").trim().slice(0, 80) || "Competent person",
        competentPhone: text(formData, "competentPhone").trim().slice(0, 40),
      },
    });
    const cleared = await invalidateSignaturesOnEdit(tx, id);
    await syncSigners(tx, id);
    return cleared;
  });
  saved(id, reset, "Job details saved. Reload the library if you changed the trade or the scope and want the hazards replaced.");
}

export async function saveRamsArrangements(formData: FormData) {
  const trader = await requireTrader();
  if (!trader) redirectWith("/login", "error", "Sign in to continue.");
  const id = text(formData, "ramsId");
  const current = await prisma.rams.findFirst({
    where: { id, traderId: trader.id },
    include: { permits: { orderBy: { sortOrder: "asc" } } },
  });
  if (!current) redirectWith("/rams", "error", "That RAMS could not be found.");
  const permitIds = column(formData, "permitId");
  const permitOn = new Set(column(formData, "permitOn"));
  const details = column(formData, "permitDetail");
  const reset = await prisma.$transaction(async (tx) => {
    await tx.rams.update({
      where: { id },
      data: {
        nearestHospital: text(formData, "nearestHospital").trim().slice(0, 240),
        emergencyNotes: text(formData, "emergencyNotes").trim().slice(0, 4000),
        firstAidNotes: text(formData, "firstAidNotes").trim().slice(0, 4000),
        welfareNotes: text(formData, "welfareNotes").trim().slice(0, 4000),
        ppe: text(formData, "ppe").trim().slice(0, 2000),
      },
    });
    for (let index = 0; index < permitIds.length; index += 1) {
      const permitId = permitIds[index];
      if (!current.permits.some((permit) => permit.id === permitId)) continue;
      await tx.ramsPermit.update({
        where: { id: permitId },
        data: {
          required: permitOn.has(permitId),
          detail: (details[index] || "").trim().slice(0, 500),
        },
      });
    }
    return invalidateSignaturesOnEdit(tx, id);
  });
  saved(id, reset, "Arrangements saved. Check the nearest A&E before work starts.");
}

export async function saveRamsHazards(formData: FormData) {
  const trader = await requireTrader();
  if (!trader) redirectWith("/login", "error", "Sign in to continue.");
  const id = text(formData, "ramsId");
  const current = await prisma.rams.findFirst({ where: { id, traderId: trader.id }, select: { id: true } });
  if (!current) redirectWith("/rams", "error", "That RAMS could not be found.");
  const activities = column(formData, "activity");
  const hazards = column(formData, "hazard");
  const who = column(formData, "whoHarmed");
  const beforeL = column(formData, "likelihoodBefore");
  const beforeS = column(formData, "severityBefore");
  const controls = column(formData, "controls");
  const afterL = column(formData, "likelihoodAfter");
  const afterS = column(formData, "severityAfter");
  const keys = column(formData, "libraryKey");
  const rows = hazards
    .map((hazard, index) => ({
      hazard: hazard.trim(),
      activity: (activities[index] || "").trim(),
      whoHarmed: (who[index] || "").trim(),
      controls: (controls[index] || "").trim(),
      libraryKey: (keys[index] || "").trim(),
      likelihoodBefore: clampScorePart(Number(beforeL[index])),
      severityBefore: clampScorePart(Number(beforeS[index])),
      likelihoodAfter: clampScorePart(Number(afterL[index])),
      severityAfter: clampScorePart(Number(afterS[index])),
    }))
    .filter((row) => row.hazard || row.controls);
  const reset = await prisma.$transaction(async (tx) => {
    await tx.ramsHazard.deleteMany({ where: { ramsId: id } });
    if (rows.length > 0) {
      await tx.ramsHazard.createMany({
        data: rows.map((row, index) => ({
          ramsId: id,
          sortOrder: index,
          libraryKey: row.libraryKey.slice(0, 80),
          activity: row.activity.slice(0, 180),
          hazard: row.hazard.slice(0, 500) || "Hazard",
          whoHarmed: row.whoHarmed.slice(0, 240),
          likelihoodBefore: row.likelihoodBefore,
          severityBefore: row.severityBefore,
          controls: row.controls.slice(0, 2000),
          likelihoodAfter: row.likelihoodAfter,
          severityAfter: row.severityAfter,
        })),
      });
    }
    return invalidateSignaturesOnEdit(tx, id);
  });
  saved(id, reset, "Risk assessment saved. The bands use likelihood × severity.");
}

export async function addRamsHazard(formData: FormData) {
  const trader = await requireTrader();
  if (!trader) redirectWith("/login", "error", "Sign in to continue.");
  const id = text(formData, "ramsId");
  const current = await prisma.rams.findFirst({
    where: { id, traderId: trader.id },
    include: { hazards: { select: { sortOrder: true } } },
  });
  if (!current) redirectWith("/rams", "error", "That RAMS could not be found.");
  const sortOrder = current.hazards.reduce((max, hazard) => Math.max(max, hazard.sortOrder), -1) + 1;
  const reset = await prisma.$transaction(async (tx) => {
    await tx.ramsHazard.create({
      data: {
        ramsId: id,
        sortOrder,
        activity: "Extra task",
        hazard: "Describe what could cause harm",
        whoHarmed: "Operatives",
        likelihoodBefore: 3,
        severityBefore: 3,
        controls: "Write the controls you will actually use on this site.",
        likelihoodAfter: 2,
        severityAfter: 2,
      },
    });
    return invalidateSignaturesOnEdit(tx, id);
  });
  saved(id, reset, "A blank hazard was added. Change it, then save the risk assessment.");
}

export async function deleteRamsHazard(formData: FormData) {
  const trader = await requireTrader();
  if (!trader) redirectWith("/login", "error", "Sign in to continue.");
  const id = text(formData, "ramsId");
  const hazardId = text(formData, "hazardId");
  const reset = await prisma.$transaction(async (tx) => {
    await tx.ramsHazard.deleteMany({ where: { id: hazardId, rams: { id, traderId: trader.id } } });
    return invalidateSignaturesOnEdit(tx, id);
  });
  saved(id, reset, "Hazard removed.");
}

export async function saveRamsMethod(formData: FormData) {
  const trader = await requireTrader();
  if (!trader) redirectWith("/login", "error", "Sign in to continue.");
  const id = text(formData, "ramsId");
  const current = await prisma.rams.findFirst({ where: { id, traderId: trader.id }, select: { id: true } });
  if (!current) redirectWith("/rams", "error", "That RAMS could not be found.");
  const steps = text(formData, "method")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 40);
  const reset = await prisma.$transaction(async (tx) => {
    await tx.ramsStep.deleteMany({ where: { ramsId: id } });
    if (steps.length > 0) {
      await tx.ramsStep.createMany({
        data: steps.map((detail, index) => ({ ramsId: id, sortOrder: index, detail: detail.slice(0, 2000) })),
      });
    }
    return invalidateSignaturesOnEdit(tx, id);
  });
  saved(id, reset, "Method statement saved. One step on each line.");
}

export async function saveRamsSubstances(formData: FormData) {
  const trader = await requireTrader();
  if (!trader) redirectWith("/login", "error", "Sign in to continue.");
  const id = text(formData, "ramsId");
  const current = await prisma.rams.findFirst({ where: { id, traderId: trader.id }, select: { id: true } });
  if (!current) redirectWith("/rams", "error", "That RAMS could not be found.");
  const names = column(formData, "substanceName");
  const hazards = column(formData, "substanceHazard");
  const controls = column(formData, "substanceControls");
  const rows = names
    .map((name, index) => ({
      name: name.trim(),
      hazard: (hazards[index] || "").trim(),
      controls: (controls[index] || "").trim(),
    }))
    .filter((row) => row.name);
  const reset = await prisma.$transaction(async (tx) => {
    await tx.ramsSubstance.deleteMany({ where: { ramsId: id } });
    if (rows.length > 0) {
      await tx.ramsSubstance.createMany({
        data: rows.map((row, index) => ({
          ramsId: id,
          sortOrder: index,
          name: row.name.slice(0, 160),
          hazard: row.hazard.slice(0, 500),
          controls: row.controls.slice(0, 1000),
        })),
      });
    }
    return invalidateSignaturesOnEdit(tx, id);
  });
  saved(id, reset, "COSHH list saved. Keep the products you will actually use.");
}

export async function addRamsSubstance(formData: FormData) {
  const trader = await requireTrader();
  if (!trader) redirectWith("/login", "error", "Sign in to continue.");
  const id = text(formData, "ramsId");
  const current = await prisma.rams.findFirst({
    where: { id, traderId: trader.id },
    include: { substances: { select: { sortOrder: true } } },
  });
  if (!current) redirectWith("/rams", "error", "That RAMS could not be found.");
  const sortOrder = current.substances.reduce((max, item) => Math.max(max, item.sortOrder), -1) + 1;
  const reset = await prisma.$transaction(async (tx) => {
    await tx.ramsSubstance.create({
      data: {
        ramsId: id,
        sortOrder,
        name: "New substance",
        hazard: "What harm it can cause",
        controls: "How you will use it, from the label",
      },
    });
    return invalidateSignaturesOnEdit(tx, id);
  });
  saved(id, reset, "A substance row was added.");
}

export async function saveRamsBriefing(formData: FormData) {
  const trader = await requireTrader();
  if (!trader) redirectWith("/login", "error", "Sign in to continue.");
  const id = text(formData, "ramsId");
  const current = await prisma.rams.findFirst({ where: { id, traderId: trader.id } });
  if (!current) redirectWith("/rams", "error", "That RAMS could not be found.");
  const names = column(formData, "operativeName");
  const roles = column(formData, "operativeRole");
  const phones = column(formData, "operativePhone");
  const rows = names
    .map((name, index) => ({
      operativeName: name.trim(),
      role: (roles[index] || "").trim(),
      phone: (phones[index] || "").trim(),
    }))
    .filter((row) => row.operativeName);
  await prisma.$transaction(async (tx) => {
    await tx.ramsBriefing.deleteMany({ where: { ramsId: id } });
    if (rows.length > 0) {
      await tx.ramsBriefing.createMany({
        data: rows.map((row, index) => ({
          ramsId: id,
          sortOrder: index,
          operativeName: row.operativeName.slice(0, 120),
          role: row.role.slice(0, 80) || "Operative",
          phone: row.phone.slice(0, 40),
        })),
      });
    }
    await syncSigners(tx, id);
    await refreshSignedStatus(tx, id);
  });
  redirectWith(back(id), "notice", "The people who need to sign are saved. Changing the wording of the RAMS still clears every signature.");
}

export async function reloadRamsFromLibrary(formData: FormData) {
  const trader = await requireTrader();
  if (!trader) redirectWith("/login", "error", "Sign in to continue.");
  const id = text(formData, "ramsId");
  const source = await reloadRamsLibrary(prisma, { traderId: trader.id, ramsId: id, completer: ramsCompleterFromEnv() });
  if (!source) redirectWith("/rams", "error", "That RAMS could not be reloaded.");
  const extra = source.source === "library-and-ai" ? " AI only chose library hazards." : "";
  saved(
    id,
    source.reset,
    `Hazards, method, COSHH and permits were replaced from the checked library.${extra} Site details were kept.`,
  );
}

export async function saveRamsAsTemplate(formData: FormData) {
  const trader = await requireTrader();
  if (!trader) redirectWith("/login", "error", "Sign in to continue.");
  const id = text(formData, "ramsId");
  const cloned = await cloneRams(prisma, { traderId: trader.id, sourceId: id, asTemplate: true });
  if (!cloned) redirectWith("/rams", "error", "That RAMS could not be saved as a template.");
  redirectWith(`/rams/${cloned.id}`, "notice", `${cloned.number} is a template. It is not tied to a job. Use it the next time you start a RAMS.`);
}

export async function deleteRams(formData: FormData) {
  const trader = await requireTrader();
  if (!trader) redirectWith("/login", "error", "Sign in to continue.");
  const id = text(formData, "ramsId");
  await prisma.rams.deleteMany({ where: { id, traderId: trader.id } });
  redirectWith("/rams", "notice", "RAMS deleted.");
}
