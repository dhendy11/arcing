import { expect, test } from "vitest";
import { arcId, localDate, newArcDoc, normalizeText, referenceSlug } from "./doc";

test("a reference slug is lowercase with single hyphens and no outer hyphens", () => {
  expect(referenceSlug("Romans 12:1-2")).toBe("romans-12-1-2");
  expect(referenceSlug("  1 John 4:7 - 12! ")).toBe("1-john-4-7-12");
});

test("an arc id is the date plus the slug", () => {
  expect(arcId("2026-09-05", "Romans 12:1-2", [])).toBe("2026-09-05-romans-12-1-2");
});

test("a colliding arc id takes the next numeric suffix", () => {
  const taken = ["2026-09-05-romans-12-1-2", "2026-09-05-romans-12-1-2-2"];
  expect(arcId("2026-09-05", "Romans 12:1-2", taken)).toBe("2026-09-05-romans-12-1-2-3");
});

test("the local date is the box timezone's calendar day, not UTC's", () => {
  // 2026-09-06T02:30:00Z is still Saturday evening in New York.
  const late = new Date("2026-09-06T02:30:00Z");
  expect(localDate(late, "America/New_York")).toBe("2026-09-05");
});

test("passage text is whitespace normalised on creation", () => {
  expect(normalizeText("  For by\n\n grace   you \t have been saved. ")).toBe(
    "For by grace you have been saved."
  );
});

test("a new arc starts as one proposition covering all of the text", () => {
  const doc = newArcDoc({
    id: "2026-09-05-romans-12-1-2",
    reference: "Romans 12:1-2",
    canonical: "Romans 12:1-2",
    source: "paste",
    text: "  I beseech you.  And do not be conformed. ",
    verses: [],
    now: new Date("2026-09-05T15:00:00Z"),
  });

  expect(doc.schemaVersion).toBe(1);
  expect(doc.rev).toBe(1);
  expect(doc.status).toBe("split");
  expect(doc.markedComplete).toBe(false);
  expect(doc.passage.text).toBe("I beseech you. And do not be conformed.");
  expect(doc.propositions).toEqual([
    { id: "p1", start: 0, end: 39, text: "I beseech you. And do not be conformed." },
  ]);
  expect(doc.arcs).toEqual([]);
  expect(doc.summary).toEqual({ mainPoint: "", levels: [], whyItMatters: "" });
});
