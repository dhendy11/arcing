import { expect, test } from "vitest";
import { BASE_FONT_PX, COLORS, ESV_NOTICE, ESV_URL, MIN_TARGET_PX } from "./tokens";

test("colour tokens are the spec's four values", () => {
  expect(COLORS).toEqual({
    paper: "#faf8f5",
    ink: "#1c1917",
    accent: "#1d4ed8",
    destructive: "#b91c1c",
  });
});

test("base type is 17 px and the touch floor is 44 px", () => {
  expect(BASE_FONT_PX).toBe(17);
  expect(MIN_TARGET_PX).toBe(44);
});

test("the ESV notice is the licence text verbatim", () => {
  expect(ESV_NOTICE).toBe(
    "Scripture quotations are from the ESV® Bible (The Holy Bible, English Standard Version®), © 2001 by Crossway, a publishing ministry of Good News Publishers. Used by permission. All rights reserved."
  );
  expect(ESV_URL).toBe("https://www.esv.org");
});
