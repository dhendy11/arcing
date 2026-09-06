import { expect, test } from "vitest";
import {
  arcsDissolvedByDissolve,
  canRelate,
  createArc,
  dissolveArc,
  relabelArc,
  setCircled,
} from "./arcTree";
import { newArcDoc } from "./doc";
import { splitAt } from "./split";
import type { ArcDoc, Member } from "./types";
import { validateDoc } from "./validate";

const prop = (ref: string): Member => ({ kind: "prop", ref });
const arc = (ref: string): Member => ({ kind: "arc", ref });

/** "one two three four five" as five propositions. */
function fiveProps(): ArcDoc {
  let doc = newArcDoc({
    id: "d", reference: "Romans 12:1-2", canonical: "Romans 12:1-2", source: "paste",
    text: "one two three four five", verses: [], now: new Date("2026-09-05T15:00:00Z"),
  });
  for (const at of [4, 8, 14, 19]) doc = splitAt(doc, at);
  return doc;
}

test("two neighbours fit a pair relationship", () => {
  expect(canRelate(fiveProps(), [prop("p1"), prop("p2")], "G")).toEqual({ ok: true });
});

test("units that are not neighbours keep the palette closed", () => {
  expect(canRelate(fiveProps(), [prop("p1"), prop("p3")], "G")).toEqual({
    ok: false,
    reason: "Select neighbours",
  });
});

test("three neighbours fit only Series, Progression, Alternative and Bilateral", () => {
  const doc = fiveProps();
  const three = [prop("p1"), prop("p2"), prop("p3")];
  for (const code of ["S", "P", "A", "BL"] as const) {
    expect(canRelate(doc, three, code).ok).toBe(true);
  }
  for (const code of ["G", "Inf", "AcPur", "NegPos", "Csv", "SitR", "T", "L", "Cf"] as const) {
    expect(canRelate(doc, three, code)).toEqual({ ok: false, reason: "Takes exactly 2" });
  }
});

test("Bilateral refuses two members", () => {
  expect(canRelate(fiveProps(), [prop("p1"), prop("p2")], "BL")).toEqual({
    ok: false,
    reason: "Takes exactly 3",
  });
});

test("a single unit fits nothing", () => {
  expect(canRelate(fiveProps(), [prop("p1")], "S")).toEqual({
    ok: false,
    reason: "Select two or more neighbours",
  });
});

test("creating an arc puts it in the forest and leaves the document valid", () => {
  const doc = createArc(fiveProps(), [prop("p1"), prop("p2")], "G");
  expect(doc.arcs).toEqual([
    { id: "a1", kind: "arc", rel: "G", circled: null, members: [prop("p1"), prop("p2")] },
  ]);
  expect(doc.status).toBe("relating");
  expect(validateDoc(doc)).toEqual([]);
});

test("members are stored in passage order however they were selected", () => {
  const doc = createArc(fiveProps(), [prop("p2"), prop("p1")], "G");
  expect(doc.arcs[0].members).toEqual([prop("p1"), prop("p2")]);
});

test("arc ids do not reuse a dissolved id", () => {
  let doc = createArc(fiveProps(), [prop("p1"), prop("p2")], "G");
  doc = createArc(doc, [prop("p3"), prop("p4")], "G");
  doc = dissolveArc(doc, "a1");
  doc = createArc(doc, [prop("p1"), prop("p2")], "G");
  expect(doc.arcs.map((a) => a.id)).toEqual(["a2", "a3"]);
});

test("an arc can be nested inside another arc", () => {
  let doc = createArc(fiveProps(), [prop("p1"), prop("p2")], "NegPos");
  doc = createArc(doc, [arc("a1"), prop("p3")], "AcPur");
  expect(doc.arcs[1].members).toEqual([arc("a1"), prop("p3")]);
  expect(validateDoc(doc)).toEqual([]);
});

test("relabelling keeps the members and clears a circle the new label cannot carry", () => {
  let doc = createArc(fiveProps(), [prop("p1"), prop("p2")], "AcPur");
  doc = setCircled(doc, "a1", 1);
  doc = relabelArc(doc, "a1", "G");
  expect(doc.arcs[0].rel).toBe("G");
  expect(doc.arcs[0].circled).toBeNull();
  expect(validateDoc(doc)).toEqual([]);
});

test("relabelling to a member count the arc cannot satisfy is refused", () => {
  const doc = createArc(fiveProps(), [prop("p1"), prop("p2")], "G");
  expect(() => relabelArc(doc, "a1", "BL")).toThrow(/Takes exactly 3/);
});

test("circling one member moves the circle off the other", () => {
  let doc = createArc(fiveProps(), [prop("p1"), prop("p2")], "AcPur");
  doc = setCircled(doc, "a1", 0);
  expect(doc.arcs[0].circled).toBe(0);
  doc = setCircled(doc, "a1", 1);
  expect(doc.arcs[0].circled).toBe(1);
});

test("circling a relationship that does not circle is refused", () => {
  const doc = createArc(fiveProps(), [prop("p1"), prop("p2")], "G");
  expect(() => setCircled(doc, "a1", 0)).toThrow(/does not take a circled member/);
});

test("dissolving an arc returns its members to the top level", () => {
  let doc = createArc(fiveProps(), [prop("p1"), prop("p2")], "G");
  doc = dissolveArc(doc, "a1");
  expect(doc.arcs).toEqual([]);
  expect(doc.status).toBe("split");
  expect(validateDoc(doc)).toEqual([]);
});

test("dissolving a nested arc dissolves the arcs above it too", () => {
  let doc = createArc(fiveProps(), [prop("p1"), prop("p2")], "NegPos");
  doc = createArc(doc, [arc("a1"), prop("p3")], "G");
  expect(arcsDissolvedByDissolve(doc, "a1")).toEqual(["a1", "a2"]);
  expect(dissolveArc(doc, "a1").arcs).toEqual([]);
});
