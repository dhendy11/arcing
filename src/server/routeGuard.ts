/**
 * The one place that decides what is reachable without a cookie. Kept out of
 * proxy.ts so it can be unit tested: importing proxy.ts into vitest drags in
 * next/server's request plumbing, which is not worth mocking for one branch.
 */
export type GuardDecision = "next" | "login";

export const PUBLIC_PATHS = ["/login"] as const;

export function guardDecision(pathname: string, signedIn: boolean): GuardDecision {
  if (PUBLIC_PATHS.includes(pathname as (typeof PUBLIC_PATHS)[number])) return "next";
  // API routes answer 401 on their own. Never mask an API status with a redirect.
  if (pathname === "/api" || pathname.startsWith("/api/")) return "next";
  return signedIn ? "next" : "login";
}
