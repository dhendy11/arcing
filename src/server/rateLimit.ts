export interface RateLimiter {
  allow(key: string, nowMs?: number): boolean;
}

/**
 * In-memory sliding window. One process, one user, so there is nothing to
 * share and nothing to persist; a restart forgiving five attempts is fine.
 */
export function createRateLimiter(limit: number, windowMs: number): RateLimiter {
  const hits = new Map<string, number[]>();
  return {
    allow(key: string, nowMs: number = Date.now()): boolean {
      const recent = (hits.get(key) ?? []).filter((t) => nowMs - t < windowMs);
      if (recent.length >= limit) {
        hits.set(key, recent);
        return false;
      }
      recent.push(nowMs);
      hits.set(key, recent);
      return true;
    },
  };
}

/** 5 tries a minute per IP, then 429. */
export const loginLimiter = createRateLimiter(5, 60_000);

/**
 * Reads the LAST hop of x-forwarded-for: the entry the reverse proxy in
 * front of this app appends, not the first hop, which is client-supplied
 * and would let a caller rotate identities to sidestep the limiter. This
 * assumes exactly one proxy sits in front (Caddy, on the same box); a
 * second proxy in the chain would move the trustworthy entry and this
 * would need to change with it.
 */
export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (!forwarded) return "unknown";
  const hops = forwarded.split(",").map((h) => h.trim()).filter(Boolean);
  return hops.length > 0 ? hops[hops.length - 1] : "unknown";
}
