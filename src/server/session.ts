import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "app_session";
export const SESSION_MAX_AGE_S = 60 * 60 * 24 * 30;

const KEY_LENGTH = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const key = scryptSync(password, salt, KEY_LENGTH);
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  try {
    const salt = Buffer.from(parts[1], "hex");
    const expected = Buffer.from(parts[2], "hex");
    if (expected.length !== KEY_LENGTH) return false;
    const actual = scryptSync(password, salt, KEY_LENGTH);
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

/** The cookie value: an expiry, and an HMAC over that expiry. */
export function signSession(expiresAtMs: number, secret: string): string {
  const payload = String(Math.floor(expiresAtMs));
  const mac = createHmac("sha256", secret).update(payload).digest("hex");
  return `${payload}.${mac}`;
}

export function verifySession(token: string, secret: string, nowMs: number): boolean {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return false;
  const payload = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  if (mac.length !== expected.length) return false;
  if (!timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return false;
  const expiry = Number(payload);
  return Number.isFinite(expiry) && nowMs < expiry;
}

/**
 * Secure everywhere except under the dev-only e2e gate: Playwright drives
 * http://localhost, and WebKit (the iPad project) refuses a Secure cookie
 * over http. The exemption rides on the same double gate as the password
 * bypass, so the standalone build can never take it.
 */
function secureAttr(): string {
  return isE2eAuthActive() ? "" : " Secure;";
}

export function sessionSetCookie(token: string): string {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly;${secureAttr()} SameSite=Lax; Max-Age=${SESSION_MAX_AGE_S}`;
}

export function sessionClearCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly;${secureAttr()} SameSite=Lax; Max-Age=0`;
}

export function readCookie(req: Request, name: string): string | null {
  const header = req.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return null;
}

export function hasValidSession(req: Request, nowMs: number = Date.now()): boolean {
  const secret = process.env.SESSION_SECRET;
  if (!secret) return false;
  const token = readCookie(req, SESSION_COOKIE);
  return token !== null && verifySession(token, secret, nowMs);
}

/**
 * Dev-only Playwright bypass. It replaces the password HASH, nothing else:
 * the login route, the cookie and every guard still run exactly as they do
 * in production. Double gated on NODE_ENV so the standalone build (which
 * pins NODE_ENV to production) can never take this branch.
 */
export const E2E_PASSWORD = "e2e-password";

export function isE2eAuthActive(): boolean {
  return process.env.APP_E2E_AUTH === "1" && process.env.NODE_ENV === "development";
}

export function passwordAccepted(password: string): boolean {
  if (isE2eAuthActive()) return password === E2E_PASSWORD;
  const stored = process.env.APP_PASSWORD_HASH;
  return typeof stored === "string" && stored.length > 0 && verifyPassword(password, stored);
}
