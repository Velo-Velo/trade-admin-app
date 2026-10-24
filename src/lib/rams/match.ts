import { isRamsTrade, type RamsTradeValue } from "./library";

const STOP = new Set(["the", "for", "and", "job", "jobs", "rams", "this", "that", "with", "from", "our", "you", "please"]);

export type JobMatchInput = {
  id: string;
  title: string;
  customerName: string;
  address: string;
  postcode: string;
  status: "BOOKED" | "IN_PROGRESS" | "DONE";
  updatedAt: Date;
};

export type JobMatch = { kind: "one"; id: string } | { kind: "many"; ids: string[] } | { kind: "none" };

function tokens(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((token) => token.length > 2 && !STOP.has(token));
}

/** Empty query picks the open job, preferring one that is already in progress. */
export function matchJob(jobs: JobMatchInput[], query: string): JobMatch {
  const wanted = tokens(query);
  if (wanted.length === 0) {
    const inProgress = jobs.filter((job) => job.status === "IN_PROGRESS");
    const booked = jobs.filter((job) => job.status === "BOOKED");
    const pool = inProgress.length > 0 ? inProgress : booked.length > 0 ? booked : jobs;
    const pick = [...pool].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0];
    return pick ? { kind: "one", id: pick.id } : { kind: "none" };
  }
  const scored = jobs
    .map((job) => {
      const hay = `${job.title} ${job.customerName} ${job.address} ${job.postcode}`.toLowerCase();
      const score = wanted.reduce((count, token) => count + (hay.includes(token) ? 1 : 0), 0);
      return { id: job.id, score };
    })
    .filter((row) => row.score > 0);
  if (scored.length === 0) return { kind: "none" };
  const best = Math.max(...scored.map((row) => row.score));
  const top = scored.filter((row) => row.score === best);
  if (top.length === 1) return { kind: "one", id: top[0].id };
  return { kind: "many", ids: top.map((row) => row.id) };
}

const TRADE_ALIASES: Array<{ pattern: RegExp; trade: RamsTradeValue }> = [
  { pattern: /^(plumbing|heating|plumber)\b/, trade: "PLUMBING_HEATING" },
  { pattern: /^(electrical|electric|electrician)\b/, trade: "ELECTRICAL" },
  { pattern: /^(roofing|roof|roofer)\b/, trade: "ROOFING" },
  { pattern: /^(carpentry|joinery|joiner|carpenter)\b/, trade: "CARPENTRY_JOINERY" },
  { pattern: /^(decorating|decorator|painting|painter)\b/, trade: "DECORATING" },
  { pattern: /^(groundworks|groundwork|landscaping|landscaper)\b/, trade: "GROUNDWORKS_LANDSCAPING" },
  { pattern: /^(building|builder)\b/, trade: "GENERAL_BUILDING" },
];

/** "roofing for the Smith job" -> roofing + "the Smith job". Unknown words stay in the job query. */
export function splitTradeQuery(query: string): { trade: RamsTradeValue | null; rest: string } {
  let rest = query.trim().replace(/^for\s+/i, "").trim();
  for (const alias of TRADE_ALIASES) {
    if (!alias.pattern.test(rest.toLowerCase())) continue;
    rest = rest
      .replace(alias.pattern, "")
      .replace(/^[\s,:.-]+/, "")
      .replace(/^for\s+/i, "")
      .trim();
    return { trade: alias.trade, rest };
  }
  return { trade: null, rest };
}

export function parseRamsTrade(value: string, fallback: RamsTradeValue): RamsTradeValue {
  return isRamsTrade(value) ? value : fallback;
}
