export const JOB_STATUSES = ["BOOKED", "IN_PROGRESS", "DONE"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const JOB_PHOTO_LIMIT = 12;

export function isJobStatus(value: string): value is JobStatus {
  return (JOB_STATUSES as readonly string[]).includes(value);
}

/** Status changes are one step at a time, so a tap moves the card to the next column. */
export function canMoveJob(from: JobStatus, to: JobStatus): boolean {
  const start = JOB_STATUSES.indexOf(from);
  const end = JOB_STATUSES.indexOf(to);
  return start >= 0 && end >= 0 && Math.abs(start - end) === 1;
}

export function invoiceMarker(status: "DRAFT" | "SENT" | "PAID" | null | undefined): "invoiced" | "paid" | null {
  if (status === "PAID") return "paid";
  if (status === "SENT") return "invoiced";
  return null;
}

export function jobTitleFromDescription(description: string): string {
  const line = description.split("\n")[0]?.trim() || "Job";
  if (line.length <= 90) return line;
  return `${line.slice(0, 87).trimEnd()}…`;
}

/** Link a new invoice only when the customer has exactly one job that has no invoice yet. */
export function soleUninvoicedJob<T extends { invoiceId: string | null }>(jobs: T[]): T | null {
  const open = jobs.filter((job) => !job.invoiceId);
  return open.length === 1 ? open[0] : null;
}

export function bookedJobPlan(status: string): { status: "BOOKED" } | null {
  if (status !== "ACCEPTED") return null;
  return { status: "BOOKED" };
}
