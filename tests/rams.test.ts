import { describe, expect, it } from "vitest";
import { documentExpiry, isCompanyDocumentKind } from "@/lib/rams/documents";
import { RAMS_DISCLAIMER } from "@/lib/rams/disclaimer";
import {
  defaultRamsTrade,
  draftFromLibrary,
  draftRamsBody,
  keywordHits,
  libraryKeys,
  packFor,
  selectHazards,
} from "@/lib/rams/library";
import { matchJob, splitTradeQuery } from "@/lib/rams/match";
import { renderRamsPdf } from "@/lib/rams/pdf";
import { riskBand, riskScore } from "@/lib/rams/risk";
import { interpretInbound } from "@/lib/whatsapp/interpret";
import { draftRamsReply } from "@/lib/whatsapp/plan";

const day = 24 * 60 * 60 * 1000;

describe("risk rating", () => {
  it("uses likelihood times severity and the 5 by 5 bands", () => {
    expect(riskScore(1, 1)).toBe(1);
    expect(riskScore(2, 2)).toBe(4);
    expect(riskScore(1, 5)).toBe(5);
    expect(riskScore(3, 3)).toBe(9);
    expect(riskScore(2, 5)).toBe(10);
    expect(riskScore(3, 5)).toBe(15);
    expect(riskScore(4, 4)).toBe(16);
    expect(riskScore(5, 5)).toBe(25);
    expect(riskBand(4).label).toBe("Low");
    expect(riskBand(5).label).toBe("Medium");
    expect(riskBand(9).label).toBe("Medium");
    expect(riskBand(10).label).toBe("High");
    expect(riskBand(15).label).toBe("High");
    expect(riskBand(16).label).toBe("Very high");
    expect(riskBand(25).label).toBe("Very high");
  });
});

describe("hazard library", () => {
  it("drafts an outside tap from plumbing without inventing gas work", () => {
    const scope = "Replace the dripping outside tap. Drill new fixings into the wall. A ladder may be needed. No hot works.";
    const body = draftFromLibrary("PLUMBING_HEATING", scope);
    const keys = body.hazards.map((hazard) => hazard.libraryKey);
    expect(keys).toContain("plumb-isolation");
    expect(keys).toContain("plumb-height");
    expect(keys).toContain("plumb-drill");
    expect(keys).not.toContain("plumb-gas");
    expect(body.permits.find((permit) => permit.name === "Working at height")?.required).toBe(true);
    expect(body.permits.find((permit) => permit.name === "Hot works")?.required).toBe(false);
    expect(body.steps[0]?.detail).toContain("outside tap");
    expect(body.emergencyNotes).toContain("RIDDOR");
    expect(body.welfareNotes).toContain("CDM 2015");
    expect(body.substances.some((item) => item.name === "Flux")).toBe(true);
    expect(body.ppe).toMatch(/footwear/i);
  });

  it("adds gas controls only when the job mentions gas", () => {
    const body = draftFromLibrary("PLUMBING_HEATING", "Annual boiler service, flue and gas tightness test");
    expect(body.hazards.map((hazard) => hazard.libraryKey)).toContain("plumb-gas");
    const gas = body.hazards.find((hazard) => hazard.libraryKey === "plumb-gas");
    expect(gas?.controls).toMatch(/Gas Safe/);
    expect(riskScore(gas?.likelihoodBefore ?? 0, gas?.severityBefore ?? 0)).toBeGreaterThan(
      riskScore(gas?.likelihoodAfter ?? 0, gas?.severityAfter ?? 0),
    );
  });

  it("keeps each trade on its own library", () => {
    const electrical = selectHazards(packFor("ELECTRICAL"), "Fit an EV charger and a new consumer unit");
    expect(electrical.map((hazard) => hazard.key)).toContain("elec-stored");
    expect(electrical.map((hazard) => hazard.key).join(" ")).not.toMatch(/roof-|plumb-/);
    const roof = draftFromLibrary("ROOFING", "Replace the garage roof");
    expect(roof.permits.find((permit) => permit.name === "Working at height")?.required).toBe(true);
    expect(roof.hazards.map((hazard) => hazard.libraryKey)).toContain("roof-fall");
    expect(draftFromLibrary("CARPENTRY_JOINERY", "Hang a door").hazards.some((hazard) => hazard.libraryKey === "carp-dust")).toBe(true);
    expect(draftFromLibrary("DECORATING", "Sand the old sash windows, possible lead").hazards.map((h) => h.libraryKey)).toContain("deco-lead");
    expect(draftFromLibrary("GROUNDWORKS_LANDSCAPING", "Patio").permits.find((permit) => permit.name.startsWith("Excavation"))?.required).toBe(true);
    expect(draftFromLibrary("GENERAL_BUILDING", "Small extension foundation").hazards.map((h) => h.libraryKey)).toContain("build-dig");
  });

  it("falls back to the library when AI returns unknown hazards", async () => {
    const library = draftFromLibrary("ELECTRICAL", "Replace a socket");
    const rejected = await draftRamsBody({
      trade: "ELECTRICAL",
      scope: "Replace a socket",
      completer: async () => ({ keys: ["invented-hazard", "another-fake"] }),
    });
    expect(rejected.source).toBe("library");
    expect(rejected.body.hazards.map((hazard) => hazard.libraryKey)).toEqual(library.hazards.map((hazard) => hazard.libraryKey));

    const failed = await draftRamsBody({
      trade: "ELECTRICAL",
      scope: "Replace a socket",
      completer: async () => {
        throw new Error("offline");
      },
    });
    expect(failed.source).toBe("library");
  });

  it("lets AI choose only library keys and keeps the core hazards", async () => {
    const allowed = libraryKeys("ROOFING");
    const picked = await draftRamsBody({
      trade: "ROOFING",
      scope: "Torch-on felt to a garage roof",
      completer: async () => ({ keys: ["roof-hot", "roof-fragile", "not-a-real-key", allowed[0]] }),
    });
    expect(picked.source).toBe("library-and-ai");
    const keys = picked.body.hazards.map((hazard) => hazard.libraryKey);
    expect(keys).toContain("roof-fall");
    expect(keys).toContain("roof-hot");
    expect(keys.every((key) => allowed.includes(key))).toBe(true);
    expect(keywordHits(["torch"], "Torch-on felt")).toBe(1);
  });

  it("states that the user must check the RAMS", () => {
    expect(RAMS_DISCLAIMER).toMatch(/You are responsible/);
    expect(RAMS_DISCLAIMER).toMatch(/not professional health and safety advice/);
    expect(RAMS_DISCLAIMER).toMatch(/CDM 2015/);
  });

  it("maps the trader's trade onto a RAMS trade", () => {
    expect(defaultRamsTrade("PLUMBING_HEATING")).toBe("PLUMBING_HEATING");
    expect(defaultRamsTrade("ELECTRICAL")).toBe("ELECTRICAL");
    expect(defaultRamsTrade("BUILDING")).toBe("GENERAL_BUILDING");
    expect(defaultRamsTrade("GENERAL")).toBe("GENERAL_BUILDING");
  });
});

describe("job matching", () => {
  const jobs = [
    {
      id: "outside",
      title: "Outside tap is dripping",
      customerName: "Riley Sample",
      address: "14 Sample Street, Bristol",
      postcode: "BS1 4ST",
      status: "IN_PROGRESS" as const,
      updatedAt: new Date("2026-10-20"),
    },
    {
      id: "kitchen",
      title: "Replaced a kitchen tap",
      customerName: "Mrs Jones Sample",
      address: "8 Sample Road, Leeds",
      postcode: "LS1 1AA",
      status: "DONE" as const,
      updatedAt: new Date("2026-10-18"),
    },
    {
      id: "basin",
      title: "Supply and fit a basin tap",
      customerName: "Alex Sample",
      address: "2 Sample Close, London",
      postcode: "SW1A 1AA",
      status: "DONE" as const,
      updatedAt: new Date("2026-10-10"),
    },
  ];

  it("matches RAMS for the outside tap and notices a tie", () => {
    expect(splitTradeQuery("for the outside tap")).toEqual({ trade: null, rest: "the outside tap" });
    expect(splitTradeQuery("roofing for the Smith job")).toEqual({ trade: "ROOFING", rest: "the Smith job" });
    expect(matchJob(jobs, "the outside tap")).toEqual({ kind: "one", id: "outside" });
    expect(matchJob(jobs, "Riley")).toEqual({ kind: "one", id: "outside" });
    expect(matchJob(jobs, "tap").kind).toBe("many");
    expect(matchJob([], "").kind).toBe("none");
    expect(matchJob(jobs, "")).toEqual({ kind: "one", id: "outside" });
  });
});

describe("WhatsApp RAMS", () => {
  it("reads a RAMS request and keeps it off the customer", () => {
    expect(interpretInbound("RAMS for the outside tap")).toEqual({ type: "rams", query: "for the outside tap" });
    expect(interpretInbound("RAMS").type).toBe("rams");
    expect(interpretInbound("Kitchen tap is dripping").type).toBe("job");
    const reply = draftRamsReply({
      number: "R-0001",
      title: "RAMS for Outside tap is dripping",
      traderUrl: "https://example.test/rams/abc",
      pdfUrl: "https://example.test/api/rams/abc/pdf",
    });
    expect(reply.customerText).toBeNull();
    expect(reply.traderText).toContain("Nothing has been sent");
    expect(reply.traderText).toContain("not health and safety advice");
    expect(reply.traderText).toContain("R-0001");
  });
});

describe("company documents", () => {
  it("flags expiry for a later accreditation pack", () => {
    const now = new Date("2026-10-24T12:00:00.000Z");
    expect(isCompanyDocumentKind("PUBLIC_LIABILITY")).toBe(true);
    expect(isCompanyDocumentKind("CHAS")).toBe(false);
    expect(documentExpiry(null, now)).toBe("none");
    expect(documentExpiry(new Date(now.getTime() + 10 * day), now)).toBe("due");
    expect(documentExpiry(new Date(now.getTime() + 40 * day), now)).toBe("ok");
    expect(documentExpiry(new Date(now.getTime() - day), now)).toBe("expired");
  });
});

describe("RAMS PDF", () => {
  it("renders a branded draft the trader can check", async () => {
    const body = draftFromLibrary("PLUMBING_HEATING", "Replace the outside tap. A ladder may be needed.");
    const pdf = await renderRamsPdf({
      number: "R-0001",
      title: "RAMS for Outside tap is dripping",
      status: "DRAFT",
      tradeLabel: "Plumbing and heating",
      businessName: "Sample Harbour Heating",
      logoText: "Sample Harbour",
      brandColour: "#1f4a38",
      phone: "07700 900100",
      tradingAddress: "Sample address, United Kingdom",
      siteAddress: "14 Sample Street, Bristol",
      sitePostcode: "BS1 4ST",
      clientName: "Riley Sample",
      clientRole: "Domestic client",
      startOn: new Date("2026-10-23T00:00:00.000Z"),
      finishOn: new Date("2026-10-25T00:00:00.000Z"),
      scopeOfWork: "Replace the outside tap. A ladder may be needed.",
      competentName: "Sam Sample",
      competentRole: "Competent person",
      competentPhone: "07700 900100",
      signedName: "",
      signedOn: null,
      nearestHospital: "Bristol Royal Infirmary (sample)",
      emergencyNotes: body.emergencyNotes,
      firstAidNotes: body.firstAidNotes,
      welfareNotes: body.welfareNotes,
      ppe: body.ppe,
      hazards: body.hazards,
      steps: body.steps,
      substances: body.substances,
      permits: body.permits,
      briefings: [{ operativeName: "Pat Sample", role: "Operative", briefedOn: null, signatureName: "" }],
    });
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(2000);
    const text = pdf
      .toString("latin1")
      .replace(/<([0-9A-Fa-f]+)>/g, (_match, hex: string) => Buffer.from(hex, "hex").toString("latin1"))
      .replace(/ (-?\d+) /g, "");
    expect(text).toContain("Sample Harbour Heating");
    expect(text).toContain("Risk assessment and method statement");
    expect(text).toContain("not professional health and safety advice");
    expect(text).toContain("Bristol Royal Infirmary");
    expect(text).toContain("Pat Sample");
    expect(text).toContain("R-0001");
    expect(text).toContain("Drafting aid only");
  });
});
