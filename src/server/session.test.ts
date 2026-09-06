import { afterEach, beforeEach, expect, test, vi } from "vitest";
import {
  E2E_PASSWORD,
  hasValidSession,
  hashPassword,
  passwordAccepted,
  readCookie,
  SESSION_COOKIE,
  sessionClearCookie,
  sessionSetCookie,
  signSession,
  verifyPassword,
  verifySession,
} from "./session";

const SECRET = "test-secret";
const env = { ...process.env };

beforeEach(() => {
  delete process.env.APP_E2E_AUTH;
  delete process.env.APP_PASSWORD_HASH;
  process.env.SESSION_SECRET = SECRET;
});

afterEach(() => {
  process.env = { ...env };
});

test("a hashed password verifies and a wrong one does not", () => {
  const stored = hashPassword("open sesame");
  expect(stored.startsWith("scrypt$")).toBe(true);
  expect(verifyPassword("open sesame", stored)).toBe(true);
  expect(verifyPassword("open sesamf", stored)).toBe(false);
});

test("two hashes of the same password differ because the salt differs", () => {
  expect(hashPassword("a")).not.toBe(hashPassword("a"));
});

test("a malformed stored hash verifies nothing", () => {
  expect(verifyPassword("a", "not-a-hash")).toBe(false);
});

test("a signed session verifies before its expiry and not after", () => {
  const token = signSession(1000, SECRET);
  expect(verifySession(token, SECRET, 999)).toBe(true);
  expect(verifySession(token, SECRET, 1001)).toBe(false);
});

test("a session signed with another secret does not verify", () => {
  expect(verifySession(signSession(1000, "other"), SECRET, 1)).toBe(false);
});

test("a tampered expiry does not verify", () => {
  const token = signSession(1000, SECRET);
  const tampered = `9999999${token.slice(token.indexOf("."))}`;
  expect(verifySession(tampered, SECRET, 1001)).toBe(false);
});

test("the cookie is httpOnly, Secure, SameSite Lax and 30 days long", () => {
  const header = sessionSetCookie("abc");
  expect(header).toContain(`${SESSION_COOKIE}=abc`);
  expect(header).toContain("HttpOnly");
  expect(header).toContain("Secure");
  expect(header).toContain("SameSite=Lax");
  expect(header).toContain("Max-Age=2592000");
  expect(header).toContain("Path=/");
  expect(sessionClearCookie()).toContain("Max-Age=0");
});

test("the dev-only e2e gate drops Secure so http localhost can hold the cookie", () => {
  process.env.APP_E2E_AUTH = "1";
  vi.stubEnv("NODE_ENV", "development");
  expect(sessionSetCookie("abc")).not.toContain("Secure");
  expect(sessionSetCookie("abc")).toContain("HttpOnly");
});

test("a cookie is read out of a request by name", () => {
  const req = new Request("https://x.test/", { headers: { cookie: "other=1; app_session=abc" } });
  expect(readCookie(req, SESSION_COOKIE)).toBe("abc");
  expect(readCookie(req, "missing")).toBeNull();
});

test("a request carrying a live cookie has a valid session", () => {
  const token = signSession(Date.now() + 1000, SECRET);
  const req = new Request("https://x.test/", { headers: { cookie: `${SESSION_COOKIE}=${token}` } });
  expect(hasValidSession(req)).toBe(true);
  expect(hasValidSession(new Request("https://x.test/"))).toBe(false);
});

test("the password is checked against the environment hash", () => {
  process.env.APP_PASSWORD_HASH = hashPassword("real");
  expect(passwordAccepted("real")).toBe(true);
  expect(passwordAccepted("fake")).toBe(false);
});

test("the e2e bypass accepts only the fixed password and only in development", () => {
  process.env.APP_E2E_AUTH = "1";
  vi.stubEnv("NODE_ENV", "development");
  expect(passwordAccepted(E2E_PASSWORD)).toBe(true);
  expect(passwordAccepted("anything else")).toBe(false);

  vi.stubEnv("NODE_ENV", "production");
  expect(passwordAccepted(E2E_PASSWORD)).toBe(false);
});
