import { relationship, type RelCode } from "./relationships";
import { deriveStatus } from "./status";
import { ancestorsOfArc, memberKey, propIndexRange, topLevelUnits } from "./tree";
import type { ArcDoc, ArcNode, Member } from "./types";

export interface Fit {
  ok: boolean;
  /** Shown on the disabled palette row. */
  reason?: string;
}

/** Selected units must all be top level, adjacent, with no gap between them. */
export function unitsAreAdjacentTopLevel(doc: ArcDoc, units: Member[]): boolean {
  const top = topLevelUnits(doc).map(memberKey);
  if (!units.every((u) => top.includes(memberKey(u)))) return false;
  const positions = units.map((u) => top.indexOf(memberKey(u))).sort((a, b) => a - b);
  return positions.every((p, i) => i === 0 || p === positions[i - 1] + 1);
}

export function canRelate(doc: ArcDoc, units: Member[], code: RelCode): Fit {
  if (units.length < 2) return { ok: false, reason: "Select two or more neighbours" };
  if (!unitsAreAdjacentTopLevel(doc, units)) return { ok: false, reason: "Select neighbours" };

  const rel = relationship(code);
  if (rel.maxMembers === null) {
    return units.length >= rel.minMembers ? { ok: true } : { ok: false, reason: `Takes ${rel.minMembers} or more` };
  }
  if (units.length !== rel.minMembers) return { ok: false, reason: `Takes exactly ${rel.minMembers}` };
  return { ok: true };
}

/** Never reuses an id, so a dissolved arc's id cannot come back on a new arc. */
export function nextArcId(doc: ArcDoc): string {
  const used = doc.arcs.map((a) => Number(a.id.slice(1))).filter((n) => Number.isFinite(n));
  return `a${Math.max(0, ...used) + 1}`;
}

function inPassageOrder(doc: ArcDoc, units: Member[]): Member[] {
  return [...units].sort((a, b) => propIndexRange(doc, a).first - propIndexRange(doc, b).first);
}

function withStatus(doc: ArcDoc, arcs: ArcNode[]): ArcDoc {
  const next: ArcDoc = { ...doc, arcs };
  return { ...next, status: deriveStatus(next) };
}

export function createArc(doc: ArcDoc, units: Member[], code: RelCode): ArcDoc {
  const fit = canRelate(doc, units, code);
  if (!fit.ok) throw new Error(fit.reason ?? "these units cannot be related");
  const node: ArcNode = {
    id: nextArcId(doc),
    kind: "arc",
    rel: code,
    circled: null,
    members: inPassageOrder(doc, units),
  };
  return withStatus(doc, [...doc.arcs, node]);
}

export function relabelArc(doc: ArcDoc, arcId: string, code: RelCode): ArcDoc {
  const target = doc.arcs.find((a) => a.id === arcId);
  if (!target) throw new Error(`unknown arc ${arcId}`);
  const rel = relationship(code);
  const n = target.members.length;
  const okCount = rel.maxMembers === null ? n >= rel.minMembers : n === rel.minMembers;
  if (!okCount) {
    const want = rel.maxMembers === null ? `Takes ${rel.minMembers} or more` : `Takes exactly ${rel.minMembers}`;
    throw new Error(want);
  }
  const circled = rel.requiresCircle && target.circled !== null && target.circled < n ? target.circled : null;
  return withStatus(doc, doc.arcs.map((a) => (a.id === arcId ? { ...a, rel: code, circled } : a)));
}

/**
 * The arc itself plus every arc above it. An ancestor cannot survive losing
 * a member, which is the same rule a split follows.
 */
export function arcsDissolvedByDissolve(doc: ArcDoc, arcId: string): string[] {
  const set = new Set([arcId, ...ancestorsOfArc(doc, arcId)]);
  return doc.arcs.filter((a) => set.has(a.id)).map((a) => a.id);
}

export function dissolveArc(doc: ArcDoc, arcId: string): ArcDoc {
  if (!doc.arcs.some((a) => a.id === arcId)) throw new Error(`unknown arc ${arcId}`);
  const going = new Set(arcsDissolvedByDissolve(doc, arcId));
  return withStatus(doc, doc.arcs.filter((a) => !going.has(a.id)));
}

export function setCircled(doc: ArcDoc, arcId: string, memberIndex: number | null): ArcDoc {
  const target = doc.arcs.find((a) => a.id === arcId);
  if (!target) throw new Error(`unknown arc ${arcId}`);
  const rel = relationship(target.rel);
  if (!rel.requiresCircle) throw new Error(`${rel.name} does not take a circled member`);
  if (memberIndex !== null && (memberIndex < 0 || memberIndex >= target.members.length)) {
    throw new Error(`member index ${memberIndex} is out of range`);
  }
  return withStatus(doc, doc.arcs.map((a) => (a.id === arcId ? { ...a, circled: memberIndex } : a)));
}
