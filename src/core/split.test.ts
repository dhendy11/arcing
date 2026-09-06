import fc from "fast-check";
import { expect, test } from "vitest";
import { newArcDoc } from "./doc";
import { arcsDissolvedByRejoin, arcsDissolvedBySplit, rejoinAt, splitAt, wordStarts } from "./split";
import type { ArcDoc } from "./types";
import { validateDoc } from "./validate";

const TEXT = "one two three four five";

function fresh(): ArcDoc {
  return newArcDoc({
    id: "d", reference: "Romans 12:1-2", canonical: "Romans 12:1-2", source: "paste",
    text: TEXT, verses: [], now: new Date("2026-09-05T15:00:00Z"),
  });
}

test("word starts are the index of every word's first character", () => {
  expect(wordStarts(TEXT)).toEqual([0, 4, 8, 14, 19]);
});

test("splitting at a word start makes two propositions numbered from one", () => {
  const doc = splitAt(fresh(), 8);
  expect(doc.propositions).toEqual([
    { id: "p1", start: 0, end: 8, text: "one two" },
    { id: "p2", start: 8, end: 23, text: "three four five" },
  ]);
  expect(validateDoc(doc)).toEqual([]);
});

test("splitting mid-word is refused", () => {
  expect(() => splitAt(fresh(), 9)).toThrow(/word start/);
});

test("splitting at an existing boundary is refused", () => {
  const doc = splitAt(fresh(), 8);
  expect(() => splitAt(doc, 8)).toThrow(/already a boundary/);
});

test("propositions renumber after a middle split", () => {
  let doc = splitAt(fresh(), 14);
  doc = splitAt(doc, 4);
  expect(doc.propositions.map((p) => p.id)).toEqual(["p1", "p2", "p3"]);
  expect(doc.propositions.map((p) => p.text)).toEqual(["one", "two three", "four five"]);
});

test("rejoining folds a proposition back into the one before it", () => {
  const doc = rejoinAt(splitAt(fresh(), 8), "p2");
  expect(doc.propositions).toEqual([{ id: "p1", start: 0, end: 23, text: TEXT }]);
});

test("rejoining the first proposition is refused", () => {
  expect(() => rejoinAt(splitAt(fresh(), 8), "p1")).toThrow(/first proposition/);
});

test("a split dissolves every arc holding the affected proposition, nested included", () => {
  let doc = splitAt(fresh(), 8);
  doc = splitAt(doc, 14);
  doc = splitAt(doc, 19);
  doc = {
    ...doc,
    arcs: [
      { id: "a1", kind: "arc", rel: "NegPos", circled: null, members: [{ kind: "prop", ref: "p1" }, { kind: "prop", ref: "p2" }] },
      { id: "a2", kind: "arc", rel: "G", circled: null, members: [{ kind: "arc", ref: "a1" }, { kind: "prop", ref: "p3" }] },
      { id: "a3", kind: "arc", rel: "S", circled: null, members: [{ kind: "arc", ref: "a2" }, { kind: "prop", ref: "p4" }] },
    ],
    status: "relating",
  };

  expect(arcsDissolvedBySplit(doc, 4)).toEqual(["a1", "a2", "a3"]);

  const after = splitAt(doc, 4);
  expect(after.arcs).toEqual([]);
  expect(after.propositions).toHaveLength(5);
  expect(validateDoc(after)).toEqual([]);
});

test("arcs that do not hold the affected proposition survive with remapped refs", () => {
  let doc = splitAt(fresh(), 8);
  doc = splitAt(doc, 14);
  doc = {
    ...doc,
    arcs: [{ id: "a1", kind: "arc", rel: "G", circled: null, members: [{ kind: "prop", ref: "p2" }, { kind: "prop", ref: "p3" }] }],
    status: "relating",
  };

  expect(arcsDissolvedBySplit(doc, 4)).toEqual([]);

  const after = splitAt(doc, 4);
  expect(after.propositions.map((p) => p.text)).toEqual(["one", "two", "three", "four five"]);
  // p2 and p3 became p3 and p4 when the earlier split renumbered them.
  expect(after.arcs[0].members).toEqual([{ kind: "prop", ref: "p3" }, { kind: "prop", ref: "p4" }]);
  expect(validateDoc(after)).toEqual([]);
});

test("a rejoin dissolves the arcs holding either side", () => {
  let doc = splitAt(fresh(), 8);
  doc = splitAt(doc, 14);
  doc = {
    ...doc,
    arcs: [{ id: "a1", kind: "arc", rel: "G", circled: null, members: [{ kind: "prop", ref: "p2" }, { kind: "prop", ref: "p3" }] }],
    status: "relating",
  };
  expect(arcsDissolvedByRejoin(doc, "p3")).toEqual(["a1"]);
  expect(rejoinAt(doc, "p3").arcs).toEqual([]);
});

test("status returns to split when the last arc dissolves", () => {
  let doc = splitAt(fresh(), 8);
  doc = {
    ...doc,
    arcs: [{ id: "a1", kind: "arc", rel: "G", circled: null, members: [{ kind: "prop", ref: "p1" }, { kind: "prop", ref: "p2" }] }],
    status: "relating",
  };
  expect(rejoinAt(doc, "p2").status).toBe("split");
});

test("the tiling invariant survives any sequence of splits and rejoins", () => {
  fc.assert(
    fc.property(fc.array(fc.nat(50), { maxLength: 40 }), (seq) => {
      let doc = fresh();
      for (const n of seq) {
        const open = wordStarts(doc.passage.text).filter(
          (s) => s > 0 && !doc.propositions.some((p) => p.start === s)
        );
        if (n % 2 === 0 && open.length > 0) {
          doc = splitAt(doc, open[n % open.length]);
        } else if (doc.propositions.length > 1) {
          doc = rejoinAt(doc, doc.propositions[1 + (n % (doc.propositions.length - 1))].id);
        }
        expect(validateDoc(doc)).toEqual([]);
      }
    })
  );
});
