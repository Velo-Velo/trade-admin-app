import type { DraftLine } from "../quotes/draft";

/**
 * Starter figures for a first draft. They are round placeholders, not
 * merchant prices and not a price list. The trader edits every line,
 * and the price book replaces a figure when a row matches.
 */
export type JobTemplate = {
  trade: "PLUMBING_HEATING";
  slug: string;
  name: string;
  summary: string;
  keywords: string[];
  lines: DraftLine[];
};

const hour = 5000;

export const PLUMBING_TEMPLATES: JobTemplate[] = [
  {
    trade: "PLUMBING_HEATING",
    slug: "tap-replacement",
    name: "Tap replacement",
    summary: "Swap a kitchen or basin tap, including isolation valves.",
    keywords: ["tap", "taps", "mixer tap", "dripping tap", "faucet", "basin tap", "kitchen tap"],
    lines: [
      { kind: "LABOUR", description: "Remove and replace tap", quantity: 1.5, unit: "hour", unitPricePence: hour },
      { kind: "MATERIAL", description: "Replacement tap", quantity: 1, unit: "item", unitPricePence: 4500 },
      { kind: "MATERIAL", description: "Isolation valves and connectors", quantity: 1, unit: "set", unitPricePence: 1200 },
      { kind: "MATERIAL", description: "Sealant and sundries", quantity: 1, unit: "set", unitPricePence: 600 },
    ],
  },
  {
    trade: "PLUMBING_HEATING",
    slug: "radiator-swap",
    name: "Radiator swap",
    summary: "Drain down, remove the old radiator and hang a new one.",
    keywords: ["radiator", "rad swap", "new radiator"],
    lines: [
      { kind: "LABOUR", description: "Drain, remove and hang radiator", quantity: 2, unit: "hour", unitPricePence: hour },
      { kind: "MATERIAL", description: "Panel radiator", quantity: 1, unit: "item", unitPricePence: 8000 },
      { kind: "MATERIAL", description: "TRV and lockshield", quantity: 1, unit: "pair", unitPricePence: 2500 },
      { kind: "MATERIAL", description: "Brackets and fixings", quantity: 1, unit: "set", unitPricePence: 1000 },
    ],
  },
  {
    trade: "PLUMBING_HEATING",
    slug: "boiler-service",
    name: "Boiler service",
    summary: "Annual service of an existing boiler. Gas work needs Gas Safe registration.",
    keywords: ["boiler service", "annual service", "service my boiler", "service the boiler", "boiler serviced"],
    lines: [
      { kind: "LABOUR", description: "Annual boiler service", quantity: 1, unit: "job", unitPricePence: 9000 },
      { kind: "MATERIAL", description: "Service kit and consumables", quantity: 1, unit: "set", unitPricePence: 1500 },
    ],
  },
  {
    trade: "PLUMBING_HEATING",
    slug: "cistern-repair",
    name: "Cistern repair",
    summary: "Diagnose and repair a toilet cistern that is running, overflowing or not flushing.",
    keywords: ["cistern", "fill valve", "flush siphon", "overflowing toilet", "toilet cistern"],
    lines: [
      { kind: "LABOUR", description: "Diagnose and repair cistern", quantity: 1, unit: "hour", unitPricePence: hour },
      { kind: "MATERIAL", description: "Fill valve or flush siphon", quantity: 1, unit: "item", unitPricePence: 1800 },
      { kind: "MATERIAL", description: "Washers and sundries", quantity: 1, unit: "set", unitPricePence: 500 },
    ],
  },
  {
    trade: "PLUMBING_HEATING",
    slug: "combi-boiler-swap",
    name: "Combi boiler swap",
    summary: "Replace a combi boiler. Gas work needs Gas Safe registration. Allowances are placeholders.",
    keywords: ["combi", "boiler swap", "boiler replacement", "new boiler", "replace the boiler", "replace my boiler", "change the boiler"],
    lines: [
      { kind: "LABOUR", description: "Replace combi boiler, labour only", quantity: 1, unit: "job", unitPricePence: 90000 },
      { kind: "MATERIAL", description: "Combi boiler allowance", quantity: 1, unit: "item", unitPricePence: 110000 },
      { kind: "MATERIAL", description: "Flue, filter and fittings allowance", quantity: 1, unit: "set", unitPricePence: 18000 },
      { kind: "MATERIAL", description: "Chemical flush and inhibitor", quantity: 1, unit: "set", unitPricePence: 4000 },
    ],
  },
  {
    trade: "PLUMBING_HEATING",
    slug: "leak-repair",
    name: "Leak repair",
    summary: "Trace and repair a leaking pipe or fitting.",
    keywords: ["leak", "leaking", "burst pipe", "pipe leak"],
    lines: [
      { kind: "LABOUR", description: "Trace and repair leak", quantity: 2, unit: "hour", unitPricePence: hour },
      { kind: "MATERIAL", description: "Pipe and fittings allowance", quantity: 1, unit: "set", unitPricePence: 2500 },
    ],
  },
  {
    trade: "PLUMBING_HEATING",
    slug: "toilet-replacement",
    name: "Toilet replacement",
    summary: "Remove a WC and fit a close-coupled replacement.",
    keywords: ["new toilet", "replace the toilet", "replace toilet", "close coupled", "wc pan", "new wc"],
    lines: [
      { kind: "LABOUR", description: "Remove and fit WC", quantity: 2, unit: "hour", unitPricePence: hour },
      { kind: "MATERIAL", description: "Close-coupled toilet", quantity: 1, unit: "item", unitPricePence: 14000 },
      { kind: "MATERIAL", description: "Pan connector, waste and seat", quantity: 1, unit: "set", unitPricePence: 2500 },
    ],
  },
  {
    trade: "PLUMBING_HEATING",
    slug: "powerflush",
    name: "Powerflush",
    summary: "Powerflush a heating system and dose with inhibitor.",
    keywords: ["powerflush", "power flush", "sludge"],
    lines: [
      { kind: "LABOUR", description: "Powerflush heating system", quantity: 1, unit: "job", unitPricePence: 35000 },
      { kind: "MATERIAL", description: "Chemicals and inhibitor", quantity: 1, unit: "set", unitPricePence: 4500 },
    ],
  },
  {
    trade: "PLUMBING_HEATING",
    slug: "cylinder-replacement",
    name: "Cylinder replacement",
    summary: "Replace a hot water cylinder. Unvented cylinders need a competent installer.",
    keywords: ["cylinder", "unvented", "hot water cylinder"],
    lines: [
      { kind: "LABOUR", description: "Replace hot water cylinder", quantity: 1, unit: "job", unitPricePence: 45000 },
      { kind: "MATERIAL", description: "Cylinder allowance", quantity: 1, unit: "item", unitPricePence: 50000 },
      { kind: "MATERIAL", description: "Valves, expansion vessel and fittings", quantity: 1, unit: "set", unitPricePence: 9000 },
    ],
  },
  {
    trade: "PLUMBING_HEATING",
    slug: "trv-replacement",
    name: "Radiator valve replacement",
    summary: "Replace a thermostatic radiator valve and lockshield.",
    keywords: ["trv", "thermostatic", "radiator valve", "lockshield"],
    lines: [
      { kind: "LABOUR", description: "Replace radiator valves", quantity: 1, unit: "hour", unitPricePence: hour },
      { kind: "MATERIAL", description: "TRV and lockshield", quantity: 1, unit: "pair", unitPricePence: 2800 },
    ],
  },
];
