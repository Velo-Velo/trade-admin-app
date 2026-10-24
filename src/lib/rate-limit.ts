const buckets = new Map<string, number[]>();

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
): { ok: boolean; remaining: number } {
  const prev = (buckets.get(key) ?? []).filter((stamp) => now - stamp < windowMs);
  if (prev.length >= limit) {
    buckets.set(key, prev);
    return { ok: false, remaining: 0 };
  }
  prev.push(now);
  buckets.set(key, prev);
  return { ok: true, remaining: limit - prev.length };
}

export function resetRateLimits(): void {
  buckets.clear();
}

export const SIGN_IN_LIMIT = { limit: 8, windowMs: 15 * 60 * 1000 };
export const ENQUIRY_LIMIT = { limit: 5, windowMs: 60 * 60 * 1000 };
export const REGISTER_LIMIT = { limit: 5, windowMs: 60 * 60 * 1000 };
