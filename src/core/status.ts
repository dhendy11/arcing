import { relationship, RELATIONSHIPS } from "./relationships";
import { isRooted } from "./tree";
import type { ArcDoc, ArcStatus } from "./types";

const KNOWN_RELS = new Set(RELATIONSHIPS.map((r) => r.code));

/**
 * What Mark complete is still waiting on, in the order the Summarize screen
 * lists it. Empty means Mark complete is allowed. One function so the button
 * gating and the derived status can never drift apart.
 */
export function completionMissing(doc: ArcDoc): string[] {
  const missing: string[] = [];
  if (!isRooted(doc)) missing.push("One arc spanning the whole passage");
  if (!doc.summary.mainPoint.trim()) missing.push("A main point sentence");
  if (!doc.summary.levels.some((l) => l.text.trim())) missing.push("At least one level with text");
  for (const arc of doc.arcs) {
    if (!KNOWN_RELS.has(arc.rel)) {
      missing.push(`A recognized relationship on the arc (${arc.id})`);
      continue;
    }
    const rel = relationship(arc.rel);
    if (rel.requiresCircle && arc.circled === null) {
      missing.push(`A circled member on the ${rel.name} arc (${arc.id})`);
    }
  }
  return missing;
}

/** Derived on every save, never typed by a client. */
export function deriveStatus(doc: ArcDoc): ArcStatus {
  if (doc.markedComplete && completionMissing(doc).length === 0) return "complete";
  return doc.arcs.length > 0 ? "relating" : "split";
}
