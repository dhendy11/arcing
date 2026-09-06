import { expect, test } from "vitest";
import {
  arcsDissolvedByDissolve,
  canRelabel,
  canRelate,
  createArc,
  dissolveArc,
  relabelArc,
  selectionFit,
  setCircled,
} from "./arcTree";
import { newArcDoc } from "./doc";
import { CIRCLING_CODES, RELATIONSHIPS } from "./relationships";
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

test("three neighbours' fit follows every relationship's own member-count rule", () => {
  const doc = fiveProps();
  const three = [prop("p1"), prop("p2"), prop("p3")];
  for (const rel of RELATIONSHIPS) {
    const fits = rel.maxMembers === null ? three.length >= rel.minMembers : three.length === rel.minMembers;
    const expected = fits ? { ok: true } : { ok: false, reason: `Takes exactly ${rel.minMembers}` };
    expect(canRelate(doc, three, rel.code)).toEqual(expected);
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

test("dissolving an arc does not free its id while another arc holds a higher number", () => {
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

test("setCircled accepts every circling relationship and refuses a non-circling one", () => {
  for (const code of CIRCLING_CODES) {
    const doc = createArc(fiveProps(), [prop("p1"), prop("p2")], code);
    expect(setCircled(doc, "a1", 0).arcs[0].circled).toBe(0);
  }
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

test("dissolving the innermost of three nested arcs dissolves the arcs above it too", () => {
  let doc = createArc(fiveProps(), [prop("p1"), prop("p2")], "NegPos");
  doc = createArc(doc, [arc("a1"), prop("p3")], "G");
  doc = createArc(doc, [arc("a2"), prop("p4")], "G");
  expect(arcsDissolvedByDissolve(doc, "a1")).toEqual(["a1", "a2", "a3"]);
  expect(validateDoc(dissolveArc(doc, "a1"))).toEqual([]);
});

test("relabel fit is judged against the arc's own member count", () => {
  let doc = createArc(fiveProps(), [prop("p1"), prop("p2")], "NegPos");
  doc = createArc(doc, [arc("a1"), prop("p3")], "G");
  expect(canRelabel(doc, "a1", "Cf")).toEqual({ ok: true });
  expect(canRelabel(doc, "a1", "BL")).toEqual({ ok: false, reason: "Takes exactly 3" });
});

test("selection fit answers the part of canRelate that no relationship changes", () => {
  const doc = fiveProps();
  expect(selectionFit(doc, [])).toEqual({ ok: false, reason: "Select two or more neighbours" });
  expect(selectionFit(doc, [prop("p1")])).toEqual({ ok: false, reason: "Select two or more neighbours" });
  expect(selectionFit(doc, [prop("p1"), prop("p3")])).toEqual({ ok: false, reason: "Select neighbours" });
  expect(selectionFit(doc, [prop("p1"), prop("p2")])).toEqual({ ok: true });
});
