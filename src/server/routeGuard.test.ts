import { expect, test } from "vitest";
import { guardDecision } from "./routeGuard";

test("the login page is reachable without a session", () => {
  expect(guardDecision("/login", false)).toBe("next");
});

test("api routes are passed through so they can answer 401 themselves", () => {
  expect(guardDecision("/api/arcs", false)).toBe("next");
  expect(guardDecision("/api/arcs/2026-09-05-romans-12-1-2", false)).toBe("next");
});

test("a page without a session goes to login", () => {
  expect(guardDecision("/", false)).toBe("login");
  expect(guardDecision("/a/2026-09-05-romans-12-1-2/split", false)).toBe("login");
});

test("a page with a session is served", () => {
  expect(guardDecision("/", true)).toBe("next");
});

test("a path that merely starts with login is not public", () => {
  expect(guardDecision("/loginish", false)).toBe("login");
});
