import type { ArcDoc, ArcNode, Member } from "./types";

export function memberKey(m: Member): string {
  return `${m.kind}:${m.ref}`;
}

export function arcById(doc: ArcDoc, id: string): ArcNode | undefined {
  return doc.arcs.find((a) => a.id === id);
}

function propIndex(doc: ArcDoc, propId: string): number {
  return doc.propositions.findIndex((p) => p.id === propId);
}

/** Every proposition id beneath a unit, in passage order. */
export function propsUnder(doc: ArcDoc, unit: Member): string[] {
  if (unit.kind === "prop") return [unit.ref];
  const node = arcById(doc, unit.ref);
  if (!node) return [];
  return node.members.flatMap((m) => propsUnder(doc, m));
}

export function propIndexRange(doc: ArcDoc, unit: Member): { first: number; last: number } {
  const indices = propsUnder(doc, unit).map((id) => propIndex(doc, id)).filter((i) => i >= 0);
  if (indices.length === 0) return { first: -1, last: -1 };
  return { first: Math.min(...indices), last: Math.max(...indices) };
}

/** A proposition is level 0; an arc is one deeper than its deepest member. */
export function unitLevel(doc: ArcDoc, unit: Member): number {
  if (unit.kind === "prop") return 0;
  const node = arcById(doc, unit.ref);
  if (!node) return 0;
  return 1 + Math.max(...node.members.map((m) => unitLevel(doc, m)));
}

/** Propositions and arcs that no arc holds, in passage order. */
export function topLevelUnits(doc: ArcDoc): Member[] {
  const held = new Set<string>();
  for (const a of doc.arcs) for (const m of a.members) held.add(memberKey(m));

  const units: Member[] = [];
  for (const p of doc.propositions) {
    const m: Member = { kind: "prop", ref: p.id };
    if (!held.has(memberKey(m))) units.push(m);
  }
  for (const a of doc.arcs) {
    const m: Member = { kind: "arc", ref: a.id };
    if (!held.has(memberKey(m))) units.push(m);
  }
  return units.sort((x, y) => propIndexRange(doc, x).first - propIndexRange(doc, y).first);
}

/**
 * One top-level unit covering every proposition. Enables Summarize. A lone
 * unrelated proposition (no arcs at all) is not rooted: relating has to
 * have actually happened, so the covering unit must itself be an arc.
 */
export function isRooted(doc: ArcDoc): boolean {
  const units = topLevelUnits(doc);
  if (units.length !== 1 || units[0].kind !== "arc") return false;
  return propsUnder(doc, units[0]).length === doc.propositions.length;
}

/** Every arc holding this proposition, directly or through a nested member. */
export function ancestorsOfProp(doc: ArcDoc, propId: string): string[] {
  return doc.arcs.filter((a) => propsUnder(doc, { kind: "arc", ref: a.id }).includes(propId)).map((a) => a.id);
}

/** Every arc holding this arc, directly or through a nested member. */
export function ancestorsOfArc(doc: ArcDoc, arcId: string): string[] {
  const out: string[] = [];
  let current = arcId;
  for (;;) {
    const parent = doc.arcs.find((a) => a.members.some((m) => m.kind === "arc" && m.ref === current));
    if (!parent) return out;
    out.push(parent.id);
    current = parent.id;
  }
}
