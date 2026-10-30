const STOP = new Set(["the", "for", "and", "job", "this", "that", "with", "from", "receipt", "photo", "please"]);

export type ReceiptJob = {
  id: string;
  customerId: string;
  title: string;
  customerName: string;
  address: string;
  postcode: string;
};

export type ReceiptJobMatch =
  | { kind: "one"; jobId: string; customerId: string; title: string }
  | { kind: "many" }
  | { kind: "none" };

function tokens(caption: string): string[] {
  return caption
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((token) => token.length > 2 && !STOP.has(token));
}

/** Links a receipt only when the trader's note matches one job. An empty note stays unlinked. */
export function matchReceiptJob(jobs: ReceiptJob[], caption: string): ReceiptJobMatch {
  const wanted = tokens(caption);
  if (wanted.length === 0) return { kind: "none" };
  const scored = jobs
    .map((job) => {
      const hay = `${job.title} ${job.customerName} ${job.address} ${job.postcode}`.toLowerCase();
      const score = wanted.reduce((count, token) => count + (hay.includes(token) ? 1 : 0), 0);
      return { job, score };
    })
    .filter((row) => row.score > 0);
  if (scored.length === 0) return { kind: "none" };
  const best = Math.max(...scored.map((row) => row.score));
  const top = scored.filter((row) => row.score === best);
  if (top.length !== 1) return { kind: "many" };
  const job = top[0].job;
  return { kind: "one", jobId: job.id, customerId: job.customerId, title: job.title };
}
