const MIN_FILL_MS = 2000;

/** Honeypot, a short fill time, or a description stuffed with links. */
export function enquirySpamReason(input: {
  honeypot: string;
  startedAt: string;
  description: string;
  now?: number;
}): "honeypot" | "timing" | "links" | null {
  if (input.honeypot.trim()) return "honeypot";
  const started = Number(input.startedAt);
  const now = input.now ?? Date.now();
  if (!Number.isFinite(started) || started <= 0) return "timing";
  if (now - started < MIN_FILL_MS) return "timing";
  if (started - now > 60_000) return "timing";
  const links = input.description.match(/https?:\/\//gi);
  if (links && links.length >= 3) return "links";
  return null;
}
