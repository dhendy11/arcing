import { expect, test } from "vitest";
import { piperRomansDoc } from "@/fixtures/piperRomans";
import { layout, wrapLines } from "./layout";
import { NEG_POS_SYMBOL } from "./relationships";
import { validateDoc } from "./validate";

test("the fixture is Piper's four propositions and three arcs, and it is valid", () => {
  const doc = piperRomansDoc();
  expect(doc.propositions.map((p) => p.text)).toEqual([
    "I beseech you by the mercies of God, brothers, to present your bodies to God as a living, holy, acceptable sacrifice which is your spiritual service of worship.",
    "And do not be conformed to this age",
    "but be transformed by the renewing of your mind,",
    "in order that you might approve what the will of God is, namely, the good, the acceptable, and the perfect.",
  ]);
  expect(doc.arcs.map((a) => [a.id, a.rel, a.circled])).toEqual([
    ["a1", "NegPos", null],
    ["a2", "AcPur", 1],
    ["a3", "AcPur", 0],
  ]);
  expect(validateDoc(doc)).toEqual([]);
});

test("wrapping is greedy at the character budget and never splits a word", () => {
  expect(wrapLines("I beseech you by the mercies of God, brothers, to present your bodies", 58)).toEqual([
    "I beseech you by the mercies of God, brothers, to present",
    "your bodies",
  ]);
  expect(wrapLines("supercalifragilistic", 5)).toEqual(["supercalifragilistic"]);
  expect(wrapLines("", 58)).toEqual([""]);
});

test("proposition rows are the mockup's boxes", () => {
  const g = layout(piperRomansDoc(), "stacked");
  expect(g.width).toBe(1024);
  expect(g.height).toBe(300);
  expect(g.props.map((p) => [p.id, p.y, p.h, p.lines.length])).toEqual([
    ["p1", 16, 96, 3],
    ["p2", 112, 48, 1],
    ["p3", 160, 48, 1],
    ["p4", 208, 72, 2],
  ]);
  expect(g.props[0].x).toBe(84);
  expect(g.props[0].w).toBe(528);
  expect(g.props[0].lines[0]).toBe("I beseech you by the mercies of God, brothers, to present");
});

test("proposition boxes never overlap", () => {
  const g = layout(piperRomansDoc(), "stacked");
  for (let i = 1; i < g.props.length; i += 1) {
    expect(g.props[i].y).toBe(g.props[i - 1].y + g.props[i - 1].h);
  }
});

test("the baseline runs the height of the stack with a tick at every boundary", () => {
  const g = layout(piperRomansDoc(), "stacked");
  expect(g.baseline).toEqual({ x: 612, y0: 16, y1: 280, ticks: [16, 112, 160, 208, 280] });
});

test("one leaf arc per proposition, at the innermost lane", () => {
  const g = layout(piperRomansDoc(), "stacked");
  expect(g.leaves).toEqual([
    { propId: "p1", d: "M612 16 A48 48 0 0 1 612 112" },
    { propId: "p2", d: "M612 112 A48 24 0 0 1 612 160" },
    { propId: "p3", d: "M612 160 A48 24 0 0 1 612 208" },
    { propId: "p4", d: "M612 208 A48 36 0 0 1 612 280" },
  ]);
});

test("one path per arc, one lane further out per nesting level", () => {
  const g = layout(piperRomansDoc(), "stacked");
  expect(g.arcs.map((a) => a.d)).toEqual([
    "M612 112 A104 48 0 0 1 612 208",
    "M612 112 A160 84 0 0 1 612 280",
    "M612 16 A216 132 0 0 1 612 280",
  ]);
});

test("each arc's symbol sits in its own lane at its vertical midpoint", () => {
  const g = layout(piperRomansDoc(), "stacked");
  expect(g.arcs.map((a) => [a.id, a.sym, a.labelX, a.labelY])).toEqual([
    ["a1", NEG_POS_SYMBOL, 690, 166],
    ["a2", "Ac/Pur", 746, 202],
    ["a3", "Ac/Pur", 802, 154],
  ]);
});

test("circle targets sit on each member, in that member's own lane", () => {
  const g = layout(piperRomansDoc(), "stacked");
  expect(g.arcs[0].circles).toEqual([]);
  expect(g.arcs[1].circles).toEqual([
    { memberIndex: 0, x: 690, y: 160 },
    { memberIndex: 1, x: 638, y: 244 },
  ]);
  expect(g.arcs[2].circles).toEqual([
    { memberIndex: 0, x: 638, y: 64 },
    { memberIndex: 1, x: 746, y: 196 },
  ]);
});

test("an unrelated document still lays out its propositions", () => {
  const doc = piperRomansDoc();
  const g = layout({ ...doc, arcs: [], status: "split" }, "stacked");
  expect(g.arcs).toEqual([]);
  expect(g.leaves).toHaveLength(4);
  expect(g.height).toBe(300);
});

test("an unknown mode throws rather than drawing something wrong", () => {
  // @ts-expect-error only the stacked mode exists in v1
  expect(() => layout(piperRomansDoc(), "biblearc")).toThrow(/unknown layout mode/);
});
