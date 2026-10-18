export const TRADES = [
  { value: "PLUMBING_HEATING", label: "Plumbing and heating" },
  { value: "ELECTRICAL", label: "Electrical" },
  { value: "BUILDING", label: "Building" },
  { value: "GENERAL", label: "Other trade" },
] as const;

export type TradeValue = (typeof TRADES)[number]["value"];

export function tradeLabel(trade: string): string {
  return TRADES.find((item) => item.value === trade)?.label ?? "Trade";
}

export const SERVICE_PRESETS: Record<TradeValue, string> = {
  PLUMBING_HEATING: [
    "Taps, toilets and leaks",
    "Radiators and heating controls",
    "Boiler servicing",
    "Cylinders and hot water",
  ].join("\n"),
  ELECTRICAL: [
    "Sockets, lights and fault finding",
    "Consumer units",
    "Small electrical repairs",
  ].join("\n"),
  BUILDING: ["Repairs and small building jobs", "Kitchens and bathrooms", "Property maintenance"].join(
    "\n",
  ),
  GENERAL: ["General repairs", "Quoted work and call-outs"].join("\n"),
};

export function defaultIntro(input: {
  businessName: string;
  trade: string;
  area: string;
  bio: string;
}): string {
  if (input.bio.trim()) return input.bio.trim();
  if (input.trade === "GENERAL") {
    return `${input.businessName} covers ${input.area}.`;
  }
  return `${input.businessName} does ${tradeLabel(input.trade).toLowerCase()} work around ${input.area}.`;
}

export function serviceLines(services: string): string[] {
  return services
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function postcodeChips(postcodes: string): string[] {
  return postcodes
    .split(/[,/\n]/)
    .map((part) => part.trim())
    .filter(Boolean);
}
