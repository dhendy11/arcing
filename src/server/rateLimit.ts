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

export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (!forwarded) return "unknown";
  return forwarded.split(",")[0].trim() || "unknown";
}
