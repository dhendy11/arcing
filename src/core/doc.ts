import { SCHEMA_VERSION, type ArcDoc, type Verse } from "./types";

/** Lowercase, runs of non-alphanumerics to one hyphen, outer hyphens dropped. */
export function referenceSlug(reference: string): string {
  return reference
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** date is YYYY-MM-DD. On collision append -2, then -3, and so on. */
export function arcId(date: string, reference: string, taken: readonly string[]): string {
  const base = `${date}-${referenceSlug(reference)}`;
  if (!taken.includes(base)) return base;
  let n = 2;
  while (taken.includes(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

/**
 * The calendar day in a named timezone. The box runs America/New_York and a
 * Saturday-night arc must not be filed under Sunday because UTC rolled over.
 * en-CA formats as YYYY-MM-DD.
 */
export function localDate(now: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(now);
}

/**
 * Collapse every whitespace run to a single space and trim. Propositions
 * index into this string, so it is normalised once at creation and never
 * again. The ESV API returns hard-wrapped paragraphs; a paste can carry
 * anything.
 */
export function normalizeText(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

export interface NewArcInput {
  id: string;
  reference: string;
  canonical: string;
  source: "esv-api" | "paste";
  text: string;
  verses: Verse[];
  now: Date;
}

export function newArcDoc(input: NewArcInput): ArcDoc {
  const text = normalizeText(input.text);
  const iso = input.now.toISOString();
  return {
    schemaVersion: SCHEMA_VERSION,
    id: input.id,
    rev: 1,
    createdAt: iso,
    updatedAt: iso,
    status: "split",
    markedComplete: false,
    passage: {
      reference: input.reference,
      canonical: input.canonical,
      translation: "ESV",
      source: input.source,
      fetchedAt: iso,
      text,
      verses: input.verses,
    },
    propositions: [{ id: "p1", start: 0, end: text.length, text }],
    arcs: [],
    summary: { mainPoint: "", levels: [], whyItMatters: "" },
  };
}
