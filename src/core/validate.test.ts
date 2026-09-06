import { expect, test } from "vitest";
import { newArcDoc } from "./doc";
import type { RelCode } from "./relationships";
import type { ArcDoc } from "./types";
import { validateDoc } from "./validate";

const TEXT = "one two three four";

function twoProps(): ArcDoc {
  const base = newArcDoc({
    id: "d", reference: "Romans 12:1-2", canonical: "Romans 12:1-2", source: "paste",
    text: TEXT, verses: [], now: new Date("2026-09-05T15:00:00Z"),
  });
  return {
    ...base,
    propositions: [
      { id: "p1", start: 0, end: 4, text: "one" },
      { id: "p2", start: 4, end: 18, text: "two three four" },
    ],
  };
}

const codes = (doc: ArcDoc) => validateDoc(doc).map((v) => v.code);

test("a freshly created document is valid", () => {
  const doc = newArcDoc({
    id: "d", reference: "Romans 12:1-2", canonical: "Romans 12:1-2", source: "paste",
    text: TEXT, verses: [], now: new Date("2026-09-05T15:00:00Z"),
  });
  expect(validateDoc(doc)).toEqual([]);
});

test("a wrong schema version is a violation", () => {
  expect(codes({ ...twoProps(), schemaVersion: 2 })).toContain("schema_version");
});

test("propositions must tile the text with no gap", () => {
  const doc = twoProps();
  doc.propositions[1] = { ...doc.propositions[1], start: 5 };
  expect(codes(doc)).toContain("tiling_gap");
});

test("propositions must not overlap", () => {
  const doc = twoProps();
  doc.propositions[1] = { ...doc.propositions[1], start: 3 };
  expect(codes(doc)).toContain("tiling_gap");
});

test("the last proposition must reach the end of the text", () => {
  const doc = twoProps();
  doc.propositions[1] = { ...doc.propositions[1], end: 14 };
  expect(codes(doc)).toContain("tiling_end");
});

test("a boundary that is not a word start is a violation", () => {
  const doc = twoProps();
  doc.propositions[0] = { id: "p1", start: 0, end: 6, text: "one tw" };
  doc.propositions[1] = { id: "p2", start: 6, end: 18, text: "o three four" };
  expect(codes(doc)).toContain("boundary_not_word_start");
});

test("proposition ids must be p1..pn in order", () => {
  const doc = twoProps();
  doc.propositions[1] = { ...doc.propositions[1], id: "p9" };
  expect(codes(doc)).toContain("proposition_id");
});

test("proposition text must match the slice of the passage", () => {
  const doc = twoProps();
  doc.propositions[0] = { ...doc.propositions[0], text: "ONE" };
  expect(codes(doc)).toContain("proposition_text");
});

test("an arc member that does not resolve is a violation", () => {
  const doc = twoProps();
  doc.arcs = [{ id: "a1", kind: "arc", rel: "G", circled: null, members: [{ kind: "prop", ref: "p1" }, { kind: "prop", ref: "p7" }] }];
  expect(codes(doc)).toContain("member_unknown");
});

test("a proposition may not appear in two arcs", () => {
  const doc = twoProps();
  doc.arcs = [
    { id: "a1", kind: "arc", rel: "G", circled: null, members: [{ kind: "prop", ref: "p1" }, { kind: "prop", ref: "p2" }] },
    { id: "a2", kind: "arc", rel: "G", circled: null, members: [{ kind: "prop", ref: "p2" }, { kind: "prop", ref: "p1" }] },
  ];
  expect(codes(doc)).toContain("member_reused");
});

test("an arc that contains itself is caught before anything recurses", () => {
  const doc = twoProps();
  doc.arcs = [{ id: "a1", kind: "arc", rel: "G", circled: null, members: [{ kind: "arc", ref: "a1" }, { kind: "prop", ref: "p1" }] }];
  expect(codes(doc)).toContain("member_cycle");
});

test("member counts follow the relationship", () => {
  const doc = twoProps();
  doc.arcs = [{ id: "a1", kind: "arc", rel: "BL", circled: null, members: [{ kind: "prop", ref: "p1" }, { kind: "prop", ref: "p2" }] }];
  expect(codes(doc)).toContain("member_count");
});

test("members must be adjacent and in passage order", () => {
  const base = newArcDoc({
    id: "d", reference: "Romans 12:1-2", canonical: "Romans 12:1-2", source: "paste",
    text: TEXT, verses: [], now: new Date("2026-09-05T15:00:00Z"),
  });
  const doc: ArcDoc = {
    ...base,
    propositions: [
      { id: "p1", start: 0, end: 4, text: "one" },
      { id: "p2", start: 4, end: 8, text: "two" },
      { id: "p3", start: 8, end: 18, text: "three four" },
    ],
    arcs: [{ id: "a1", kind: "arc", rel: "G", circled: null, members: [{ kind: "prop", ref: "p1" }, { kind: "prop", ref: "p3" }] }],
  };
  expect(codes(doc)).toContain("member_not_adjacent");
});

test("only the three circling relationships may carry a circled index", () => {
  const doc = twoProps();
  doc.arcs = [{ id: "a1", kind: "arc", rel: "G", circled: 0, members: [{ kind: "prop", ref: "p1" }, { kind: "prop", ref: "p2" }] }];
  expect(codes(doc)).toContain("circle_not_allowed");
});

test("a circled index must point at a real member", () => {
  const doc = twoProps();
  doc.arcs = [{ id: "a1", kind: "arc", rel: "AcPur", circled: 5, members: [{ kind: "prop", ref: "p1" }, { kind: "prop", ref: "p2" }] }];
  expect(codes(doc)).toContain("circle_range");
});

test("the topmost level carries no connector", () => {
  const doc = twoProps();
  doc.summary = { mainPoint: "x", levels: [{ text: "a", connector: "therefore" }, { text: "b", connector: "so" }], whyItMatters: "" };
  expect(codes(doc)).toContain("top_connector");
});

test("a typed status that disagrees with the derived one is a violation", () => {
  const doc = twoProps();
  doc.status = "complete";
  expect(codes(doc)).toContain("status_derived");
});

test("an unrecognized relationship code is a violation, not a throw", () => {
  const doc = twoProps();
  doc.arcs = [{ id: "a1", kind: "arc", rel: "ZZ" as unknown as RelCode, circled: null, members: [{ kind: "prop", ref: "p1" }, { kind: "prop", ref: "p2" }] }];
  expect(() => validateDoc(doc)).not.toThrow();
  expect(codes(doc)).toContain("unknown_relationship");
});
