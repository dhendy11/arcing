import type { RelCode } from "./relationships";

export const SCHEMA_VERSION = 1;

export type ArcStatus = "split" | "relating" | "complete";

export interface Verse {
  n: number;
  /** Index into passage.text of the verse's first character. */
  start: number;
}

export interface Passage {
  reference: string;
  canonical: string;
  translation: "ESV";
  source: "esv-api" | "paste";
  fetchedAt: string;
  text: string;
  verses: Verse[];
}

export interface Proposition {
  id: string;
  start: number;
  end: number;
  text: string;
}

export type Member = { kind: "prop"; ref: string } | { kind: "arc"; ref: string };

export interface ArcNode {
  id: string;
  kind: "arc";
  rel: RelCode;
  /** 0-based member index for AcPur, AcRes and SitR, else null. */
  circled: number | null;
  members: Member[];
}

export interface Level {
  text: string;
  /** Free text into the level above. "" on the topmost level. */
  connector: string;
}

export interface Summary {
  mainPoint: string;
  /** levels[0] is the bottom, the most basic argument. */
  levels: Level[];
  whyItMatters: string;
}

export interface ArcDoc {
  schemaVersion: number;
  id: string;
  rev: number;
  createdAt: string;
  updatedAt: string;
  /** Derived on every save by deriveStatus. Never typed by a client. */
  status: ArcStatus;
  /**
   * Set true when Mark complete succeeds, false when it is undone. status
   * is "complete" only while this is true AND completionMissing is empty,
   * which is the spec's rule and cannot be computed without this flag.
   */
  markedComplete: boolean;
  passage: Passage;
  propositions: Proposition[];
  arcs: ArcNode[];
  summary: Summary;
}
