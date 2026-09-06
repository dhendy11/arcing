import { expect, test } from "vitest";
import { clientIp, createRateLimiter } from "./rateLimit";

test("the sixth attempt in a minute is refused", () => {
  const limiter = createRateLimiter(5, 60_000);
  for (let i = 0; i < 5; i += 1) expect(limiter.allow("1.2.3.4", 1000)).toBe(true);
  expect(limiter.allow("1.2.3.4", 1000)).toBe(false);
});

test("the window slides, so attempts are allowed again a minute later", () => {
  const limiter = createRateLimiter(5, 60_000);
  for (let i = 0; i < 5; i += 1) limiter.allow("1.2.3.4", 1000);
  expect(limiter.allow("1.2.3.4", 61_001)).toBe(true);
});

test("one address being refused does not refuse another", () => {
  const limiter = createRateLimiter(5, 60_000);
  for (let i = 0; i < 6; i += 1) limiter.allow("1.2.3.4", 1000);
  expect(limiter.allow("5.6.7.8", 1000)).toBe(true);
});

test("the client address is the first hop of x-forwarded-for", () => {
  const req = new Request("https://x.test/", { headers: { "x-forwarded-for": "9.9.9.9, 10.0.0.1" } });
  expect(clientIp(req)).toBe("9.9.9.9");
  expect(clientIp(new Request("https://x.test/"))).toBe("unknown");
});
