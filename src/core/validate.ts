import { relationship, RELATIONSHIPS } from "./relationships";
import { deriveStatus } from "./status";
import { arcById, memberKey, propIndexRange } from "./tree";
import { SCHEMA_VERSION, type ArcDoc, type Member } from "./types";

export interface Violation {
  code: string;
  message: string;
}

const KNOWN_RELS = new Set(RELATIONSHIPS.map((r) => r.code));

/**
 * The one authority on a legal document. The PUT route rejects any body
 * that produces a violation, so every rule the core enforces has to be
 * expressed here rather than in a screen.
 *
 * Structural problems (unknown member, cycle) are checked and returned
 * FIRST, on their own: propIndexRange and propsUnder recurse through
 * members and would not terminate on a cycle.
 */
export function validateDoc(doc: ArcDoc): Violation[] {
  const v: Violation[] = [];
  const push = (code: string, message: string) => v.push({ code, message });

  const structural = structuralViolations(doc);
  if (structural.length > 0) return structural;

  if (doc.schemaVersion !== SCHEMA_VERSION) {
    push("schema_version", `schemaVersion must be ${SCHEMA_VERSION}`);
  }

  const text = doc.passage.text;
  if (doc.propositions.length === 0) push("propositions_empty", "a document has at least one proposition");

  doc.propositions.forEach((p, i) => {
    if (p.id !== `p${i + 1}`) push("proposition_id", `proposition ${i} should be p${i + 1}, found ${p.id}`);
    if (p.start >= p.end) push("tiling_gap", `proposition ${p.id} is empty`);
    const expectedStart = i === 0 ? 0 : doc.propositions[i - 1].end;
    if (p.start !== expectedStart) {
      push("tiling_gap", `proposition ${p.id} starts at ${p.start}, expected ${expectedStart}`);
    }
    if (i > 0 && !isWordStart(text, p.start)) {
      push("boundary_not_word_start", `proposition ${p.id} does not start on a word`);
    }
    if (p.text !== text.slice(p.start, p.end).trim()) {
      push("proposition_text", `proposition ${p.id} text does not match the passage slice`);
    }
  });

  const last = doc.propositions[doc.propositions.length - 1];
  if (last && last.end !== text.length) {
    push("tiling_end", `the last proposition ends at ${last.end}, expected ${text.length}`);
  }

  for (const arc of doc.arcs) {
    const n = arc.members.length;

    if (!KNOWN_RELS.has(arc.rel)) {
      push("unknown_relationship", `${arc.id} has an unrecognized relationship code ${arc.rel}`);
    } else {
      const rel = relationship(arc.rel);
      const okCount = rel.maxMembers === null ? n >= rel.minMembers : n === rel.minMembers;
      if (!okCount) {
        const want = rel.maxMembers === null ? `${rel.minMembers} or more` : `exactly ${rel.minMembers}`;
        push("member_count", `${arc.id} (${rel.name}) takes ${want} members, found ${n}`);
      }

      if (!rel.requiresCircle && arc.circled !== null) {
        push("circle_not_allowed", `${arc.id} (${rel.name}) does not take a circled member`);
      }
      if (arc.circled !== null && (!Number.isInteger(arc.circled) || arc.circled < 0 || arc.circled >= n)) {
        push("circle_range", `${arc.id} circled index ${arc.circled} is out of range`);
      }
    }

    for (let i = 1; i < arc.members.length; i += 1) {
      const before = propIndexRange(doc, arc.members[i - 1]);
      const after = propIndexRange(doc, arc.members[i]);
      if (before.last + 1 !== after.first) {
        push("member_not_adjacent", `${arc.id} members ${i - 1} and ${i} are not adjacent`);
      }
    }
  }

  const levels = doc.summary.levels;
  if (levels.length > 0 && levels[levels.length - 1].connector !== "") {
    push("top_connector", "the topmost level carries no connector");
  }

  if (doc.status !== deriveStatus(doc)) {
    push("status_derived", `status is ${doc.status}, derived is ${deriveStatus(doc)}`);
  }

  return v;
}

export function isWordStart(text: string, index: number): boolean {
  if (index <= 0) return index === 0;
  if (index >= text.length) return false;
  return /\S/.test(text[index]) && /\s/.test(text[index - 1]);
}

function structuralViolations(doc: ArcDoc): Violation[] {
  const v: Violation[] = [];
  const propIds = new Set(doc.propositions.map((p) => p.id));
  const arcIds = new Set(doc.arcs.map((a) => a.id));
  if (arcIds.size !== doc.arcs.length) v.push({ code: "arc_id", message: "arc ids must be unique" });

  const seen = new Map<string, number>();
  for (const arc of doc.arcs) {
    for (const m of arc.members) {
      const known = m.kind === "prop" ? propIds.has(m.ref) : arcIds.has(m.ref);
      if (!known) v.push({ code: "member_unknown", message: `${arc.id} holds unknown member ${memberKey(m)}` });
      const count = (seen.get(memberKey(m)) ?? 0) + 1;
      seen.set(memberKey(m), count);
      if (count === 2) v.push({ code: "member_reused", message: `${memberKey(m)} is held by more than one arc` });
    }
  }

  if (hasCycle(doc)) v.push({ code: "member_cycle", message: "an arc contains itself" });
  return v;
}

function hasCycle(doc: ArcDoc): boolean {
  const state = new Map<string, "open" | "done">();
  const walk = (id: string): boolean => {
    const seen = state.get(id);
    if (seen === "open") return true;
    if (seen === "done") return false;
    state.set(id, "open");
    const node = arcById(doc, id);
    const members: Member[] = node ? node.members : [];
    for (const m of members) {
      if (m.kind === "arc" && walk(m.ref)) return true;
    }
    state.set(id, "done");
    return false;
  };
  return doc.arcs.some((a) => walk(a.id));
}
