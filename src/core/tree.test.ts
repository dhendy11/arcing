import { expect, test } from "vitest";
import type { ArcDoc, ArcNode, Member } from "./types";
import {
  ancestorsOfProp,
  isRooted,
  propIndexRange,
  propsUnder,
  topLevelUnits,
  unitLevel,
} from "./tree";

/** Four propositions, no arcs. Text content is irrelevant to these queries. */
function baseDoc(): ArcDoc {
  const words = ["one", "two", "three", "four"];
  let at = 0;
  const propositions = words.map((w, i) => {
    const start = at;
    at += w.length + 1;
    return { id: `p${i + 1}`, start, end: at - 1, text: w };
  });
  return {
    schemaVersion: 1,
    id: "x",
    rev: 1,
    createdAt: "",
    updatedAt: "",
    status: "split",
    markedComplete: false,
    passage: {
      reference: "r", canonical: "r", translation: "ESV", source: "paste",
      fetchedAt: "", text: words.join(" "), verses: [],
    },
    propositions,
    arcs: [],
    summary: { mainPoint: "", levels: [], whyItMatters: "" },
  };
}

const prop = (ref: string): Member => ({ kind: "prop", ref });
const arc = (ref: string): Member => ({ kind: "arc", ref });

function nested(): ArcDoc {
  const doc = baseDoc();
  const arcs: ArcNode[] = [
    { id: "a1", kind: "arc", rel: "NegPos", circled: null, members: [prop("p2"), prop("p3")] },
    { id: "a2", kind: "arc", rel: "AcPur", circled: 1, members: [arc("a1"), prop("p4")] },
    { id: "a3", kind: "arc", rel: "AcPur", circled: 0, members: [prop("p1"), arc("a2")] },
  ];
  return { ...doc, arcs };
}

test("with no arcs every proposition is a top-level unit", () => {
  expect(topLevelUnits(baseDoc())).toEqual([prop("p1"), prop("p2"), prop("p3"), prop("p4")]);
});

test("a nested forest has one top-level unit", () => {
  expect(topLevelUnits(nested())).toEqual([arc("a3")]);
});

test("top-level units come back in passage order", () => {
  const doc = baseDoc();
  const partial: ArcDoc = {
    ...doc,
    arcs: [{ id: "a1", kind: "arc", rel: "NegPos", circled: null, members: [prop("p2"), prop("p3")] }],
  };
  expect(topLevelUnits(partial)).toEqual([prop("p1"), arc("a1"), prop("p4")]);
});

test("a unit's proposition range spans its deepest members", () => {
  expect(propIndexRange(nested(), arc("a2"))).toEqual({ first: 1, last: 3 });
  expect(propIndexRange(nested(), prop("p1"))).toEqual({ first: 0, last: 0 });
});

test("propsUnder lists every proposition beneath a unit in order", () => {
  expect(propsUnder(nested(), arc("a2"))).toEqual(["p2", "p3", "p4"]);
});

test("a proposition is level 0 and each enclosing arc is one deeper", () => {
  const doc = nested();
  expect(unitLevel(doc, prop("p1"))).toBe(0);
  expect(unitLevel(doc, arc("a1"))).toBe(1);
  expect(unitLevel(doc, arc("a2"))).toBe(2);
  expect(unitLevel(doc, arc("a3"))).toBe(3);
});

test("a doc is rooted when one top-level unit covers every proposition", () => {
  expect(isRooted(nested())).toBe(true);
  expect(isRooted(baseDoc())).toBe(false);
});

test("a single proposition and no arcs is not rooted", () => {
  const doc = baseDoc();
  const one: ArcDoc = { ...doc, propositions: [doc.propositions[0]] };
  expect(isRooted(one)).toBe(false);
});

test("ancestorsOfProp walks the chain outward in document order", () => {
  expect(ancestorsOfProp(nested(), "p3")).toEqual(["a1", "a2", "a3"]);
  expect(ancestorsOfProp(nested(), "p1")).toEqual(["a3"]);
});
