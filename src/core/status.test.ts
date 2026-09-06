import { expect, test } from "vitest";
import { newArcDoc } from "./doc";
import { completionMissing, deriveStatus } from "./status";
import type { ArcDoc } from "./types";

function docWith(patch: Partial<ArcDoc>): ArcDoc {
  const base = newArcDoc({
    id: "d", reference: "Romans 12:1-2", canonical: "Romans 12:1-2", source: "paste",
    text: "one two three four", verses: [], now: new Date("2026-09-05T15:00:00Z"),
  });
  const propositions = [
    { id: "p1", start: 0, end: 3, text: "one" },
    { id: "p2", start: 4, end: 18, text: "two three four" },
  ];
  return { ...base, propositions, ...patch };
}

test("status is split with no arcs", () => {
  expect(deriveStatus(docWith({}))).toBe("split");
});

test("status is relating once an arc exists", () => {
  const doc = docWith({
    arcs: [{ id: "a1", kind: "arc", rel: "G", circled: null, members: [{ kind: "prop", ref: "p1" }, { kind: "prop", ref: "p2" }] }],
  });
  expect(deriveStatus(doc)).toBe("relating");
});

test("status is complete only when marked and the conditions still hold", () => {
  const doc = docWith({
    markedComplete: true,
    arcs: [{ id: "a1", kind: "arc", rel: "G", circled: null, members: [{ kind: "prop", ref: "p1" }, { kind: "prop", ref: "p2" }] }],
    summary: { mainPoint: "God is glorified in mercy.", levels: [{ text: "bottom", connector: "" }], whyItMatters: "" },
  });
  expect(completionMissing(doc)).toEqual([]);
  expect(deriveStatus(doc)).toBe("complete");
});

test("marking complete does not survive a condition breaking", () => {
  const doc = docWith({
    markedComplete: true,
    arcs: [],
    summary: { mainPoint: "God is glorified in mercy.", levels: [{ text: "bottom", connector: "" }], whyItMatters: "" },
  });
  expect(deriveStatus(doc)).toBe("split");
});

test("the missing list names every unmet condition", () => {
  const doc = docWith({
    arcs: [{ id: "a1", kind: "arc", rel: "AcPur", circled: null, members: [{ kind: "prop", ref: "p1" }, { kind: "prop", ref: "p2" }] }],
    summary: { mainPoint: "   ", levels: [{ text: "", connector: "" }], whyItMatters: "" },
  });
  expect(completionMissing(doc)).toEqual([
    "A main point sentence",
    "At least one level with text",
    "A circled member on the Action-Purpose arc (a1)",
  ]);
});

test("an unrooted passage is itself a missing condition", () => {
  expect(completionMissing(docWith({}))).toContain("One arc spanning the whole passage");
});
