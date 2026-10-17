import type { ChecklistStatus, LineKind } from "@prisma/client";
import { checklistForTrade } from "./checklist/catalog";
import { SERVICE_PRESETS } from "./trades";

/** Reserved address. Password sign-in is refused unless DEMO_MODE=true, and the button is the way in. */
export const DEMO_EMAIL = "sample.trader@example.com";
export const DEMO_SLUG = "sample-harbour-heating";
export const DEMO_BUSINESS_NAME = "Sample Harbour Heating";

export function demoModeEnabled(): boolean {
  return process.env.DEMO_MODE === "true";
}

export function isDemoEmail(email: string): boolean {
  return email.trim().toLowerCase() === DEMO_EMAIL;
}

export function isDemoSlug(slug: string): boolean {
  return slug === DEMO_SLUG;
}

export const DEMO_TRADER = {
  businessName: DEMO_BUSINESS_NAME,
  slug: DEMO_SLUG,
  trade: "PLUMBING_HEATING" as const,
  area: "Sample visits across the UK",
  postcodes: "SW, M, EH, CF, BT",
  phone: "07700 900100",
  logoText: "Sample Harbour",
  brandColour: "#1f4a38",
  services: SERVICE_PRESETS.PLUMBING_HEATING,
  bio: "Sample business for trying Quotestick. Not a real trader, and not taking work. The jobs, prices and registration numbers below are made up.",
};

export type DemoPriceRow = {
  kind: LineKind;
  description: string;
  unit: string;
  sellPricePence: number;
  lastPaidPence: number | null;
  merchant: string | null;
};

/** Round placeholder figures. Not merchant prices. */
export const DEMO_PRICE_BOOK: DemoPriceRow[] = [
  {
    kind: "LABOUR",
    description: "Remove and replace tap",
    unit: "hour",
    sellPricePence: 5500,
    lastPaidPence: null,
    merchant: null,
  },
  {
    kind: "MATERIAL",
    description: "Replacement tap",
    unit: "item",
    sellPricePence: 6200,
    lastPaidPence: 4100,
    merchant: "Sample Merchant",
  },
  {
    kind: "MATERIAL",
    description: "Isolation valves and connectors",
    unit: "set",
    sellPricePence: 1500,
    lastPaidPence: 900,
    merchant: "Sample Merchant",
  },
  {
    kind: "MATERIAL",
    description: "Sealant and sundries",
    unit: "set",
    sellPricePence: 800,
    lastPaidPence: 450,
    merchant: "Sample Merchant",
  },
  {
    kind: "LABOUR",
    description: "Drain, remove and hang radiator",
    unit: "hour",
    sellPricePence: 5200,
    lastPaidPence: null,
    merchant: null,
  },
  {
    kind: "MATERIAL",
    description: "Panel radiator",
    unit: "item",
    sellPricePence: 9800,
    lastPaidPence: 7400,
    merchant: "Sample Merchant",
  },
  {
    kind: "MATERIAL",
    description: "TRV and lockshield",
    unit: "pair",
    sellPricePence: 2800,
    lastPaidPence: 1900,
    merchant: "Sample Merchant",
  },
  {
    kind: "LABOUR",
    description: "Annual boiler service",
    unit: "job",
    sellPricePence: 9500,
    lastPaidPence: null,
    merchant: null,
  },
  {
    kind: "MATERIAL",
    description: "Service kit and consumables",
    unit: "set",
    sellPricePence: 1800,
    lastPaidPence: 1200,
    merchant: "Sample Merchant",
  },
  {
    kind: "LABOUR",
    description: "Diagnose and repair cistern",
    unit: "hour",
    sellPricePence: 5000,
    lastPaidPence: null,
    merchant: null,
  },
  {
    kind: "MATERIAL",
    description: "Fill valve or flush siphon",
    unit: "item",
    sellPricePence: 2200,
    lastPaidPence: 1400,
    merchant: "Sample Merchant",
  },
];

export type DemoQuoteStatus = "DRAFT" | "SENT" | "ACCEPTED";

export type DemoEnquiry = {
  customerName: string;
  contact: string;
  postcode: string;
  jobDescription: string;
  status: DemoQuoteStatus;
  /** How many days ago the enquiry arrived. Approval and acceptance sit slightly later. */
  daysAgo: number;
};

export const DEMO_ENQUIRIES: DemoEnquiry[] = [
  {
    customerName: "Alex Sample",
    contact: "alex.sample@example.com",
    postcode: "SW1A 1AA",
    jobDescription:
      "The kitchen tap is dripping and the spout is loose. Please replace the kitchen tap.",
    status: "DRAFT",
    daysAgo: 1,
  },
  {
    customerName: "Priya Sample",
    contact: "07700 900201",
    postcode: "M1 1AE",
    jobDescription:
      "The radiator in the front room is cold and leaking at the valve. Please fit a new radiator.",
    status: "DRAFT",
    daysAgo: 2,
  },
  {
    customerName: "Jordan Sample",
    contact: "jordan.sample@example.com",
    postcode: "EH1 1AA",
    jobDescription: "Please book an annual service for the boiler before winter.",
    status: "SENT",
    daysAgo: 6,
  },
  {
    customerName: "Sam Sample",
    contact: "sam.sample@example.com",
    postcode: "CF10 1AA",
    jobDescription:
      "The toilet cistern keeps running after a flush and the overflow drips. Please repair the cistern.",
    status: "ACCEPTED",
    daysAgo: 10,
  },
];

type ChecklistOverride = {
  status: ChecklistStatus;
  referenceNumber?: string;
  showOnWebsite?: boolean;
  expiresInDays?: number;
};

export const DEMO_CHECKLIST_OVERRIDES: Record<string, ChecklistOverride> = {
  "hmrc-self-assessment": { status: "DONE" },
  "business-records": { status: "DONE" },
  "public-liability": {
    status: "DONE",
    referenceNumber: "Sample only — not a real policy",
    showOnWebsite: true,
    expiresInDays: 21,
  },
  "employers-liability": { status: "NOT_APPLICABLE" },
  cis: { status: "IN_PROGRESS" },
  "waste-carrier": { status: "IN_PROGRESS" },
  "gas-safe": {
    status: "DONE",
    referenceNumber: "SAMPLE-0000",
    showOnWebsite: true,
    expiresInDays: 300,
  },
};

export function demoChecklistSeed() {
  return checklistForTrade("PLUMBING_HEATING").map((item) => {
    const extra = DEMO_CHECKLIST_OVERRIDES[item.key];
    return {
      key: item.key,
      title: item.title,
      detail: item.detail,
      officialUrl: item.officialUrl,
      verifyUrl: item.verifyUrl,
      badgeLabel: item.badgeLabel,
      publicRegister: item.publicRegister,
      reminderDays: item.reminderDays,
      sortOrder: item.sortOrder,
      status: extra?.status ?? ("NOT_STARTED" as ChecklistStatus),
      referenceNumber: extra?.referenceNumber ?? "",
      showOnWebsite: extra?.showOnWebsite ?? false,
      expiresInDays: extra?.expiresInDays ?? null,
    };
  });
}
