import { deriveStatus } from "./status";
import { ancestorsOfProp } from "./tree";
import type { ArcDoc, Member, Proposition } from "./types";
import { isWordStart } from "./validate";

/** Index of the first character of every word in the passage. */
export function wordStarts(text: string): number[] {
  const starts: number[] = [];
  for (let i = 0; i < text.length; i += 1) {
    if (/\S/.test(text[i]) && (i === 0 || /\s/.test(text[i - 1]))) starts.push(i);
  }
  return starts;
}

export function propositionAt(doc: ArcDoc, charIndex: number): Proposition | undefined {
  return doc.propositions.find((p) => charIndex >= p.start && charIndex < p.end);
}

export function arcsDissolvedBySplit(doc: ArcDoc, charIndex: number): string[] {
  const target = propositionAt(doc, charIndex);
  return target ? ancestorsOfProp(doc, target.id) : [];
}

export function arcsDissolvedByRejoin(doc: ArcDoc, propId: string): string[] {
  const index = doc.propositions.findIndex((p) => p.id === propId);
  if (index <= 0) return [];
  const previous = doc.propositions[index - 1].id;
  const affected = new Set([...ancestorsOfProp(doc, previous), ...ancestorsOfProp(doc, propId)]);
  return doc.arcs.filter((a) => affected.has(a.id)).map((a) => a.id);
}

export function splitAt(doc: ArcDoc, charIndex: number): ArcDoc {
  if (!isWordStart(doc.passage.text, charIndex) || charIndex === 0) {
    throw new Error(`split index ${charIndex} is not a word start`);
  }
  if (doc.propositions.some((p) => p.start === charIndex)) {
    throw new Error(`split index ${charIndex} is already a boundary`);
  }
  const starts = [...doc.propositions.map((p) => p.start), charIndex].sort((a, b) => a - b);
  return rebuild(doc, starts, new Set(arcsDissolvedBySplit(doc, charIndex)));
}

export function rejoinAt(doc: ArcDoc, propId: string): ArcDoc {
  const index = doc.propositions.findIndex((p) => p.id === propId);
  if (index < 0) throw new Error(`unknown proposition ${propId}`);
  if (index === 0) throw new Error("the first proposition has nothing before it to rejoin");
  const dropped = doc.propositions[index].start;
  const starts = doc.propositions.map((p) => p.start).filter((s) => s !== dropped);
  return rebuild(doc, starts, new Set(arcsDissolvedByRejoin(doc, propId)));
}

/**
 * Rebuild the propositions from a boundary list, renumber them p1..pn, drop
 * the dissolved arcs and remap the survivors' proposition refs.
 *
 * Remapping is by START OFFSET, which is sound because every arc touching a
 * proposition whose start moved is in the dissolved set by construction.
 */
function rebuild(doc: ArcDoc, starts: number[], dissolved: Set<string>): ArcDoc {
  const text = doc.passage.text;
  const propositions: Proposition[] = starts.map((start, i) => {
    const end = i + 1 < starts.length ? starts[i + 1] : text.length;
    return { id: `p${i + 1}`, start, end, text: text.slice(start, end).trim() };
  });

  const idByStart = new Map(propositions.map((p) => [p.start, p.id]));
  const remap = new Map<string, string>();
  for (const old of doc.propositions) {
    const next = idByStart.get(old.start);
    if (next) remap.set(old.id, next);
  }

  const arcs = doc.arcs
    .filter((a) => !dissolved.has(a.id))
    .map((a) => ({
      ...a,
      members: a.members.map((m): Member => (m.kind === "prop" ? { kind: "prop", ref: remap.get(m.ref) ?? m.ref } : m)),
    }));

  const next: ArcDoc = { ...doc, propositions, arcs };
  return { ...next, status: deriveStatus(next) };
}
