// Piper's 18 logical relationships (booklet pp. 12-19, chart pp. 33-34).
// Names, symbols and group order follow Piper's chart; the one-line
// definitions are quoted verbatim from Biblearc's cheat sheet as recorded
// in references/personal/bible-arcing-primer.md section (b). Do not reword
// a definition: relationships.test.ts pins three of them and the whole
// point of this screen is that Drew compares candidates rather than
// recalling a name.
export type RelGroup = "coordinate" | "restatement" | "distinct" | "contrary";

export type RelCode =
  | "S" | "P" | "A"
  | "AcMn" | "Cf" | "NegPos" | "IdExp" | "QA"
  | "G" | "Inf" | "BL" | "AcRes" | "AcPur" | "IfTh" | "T" | "L"
  | "Csv" | "SitR";

export interface Relationship {
  code: RelCode;
  name: string;
  /** What is drawn on the arc. */
  symbol: string;
  group: RelGroup;
  definition: string;
  minMembers: number;
  /** null means unbounded above (the three coordinate relationships). */
  maxMembers: number | null;
  requiresCircle: boolean;
  warning?: string;
}

export const GROUP_ORDER: readonly RelGroup[] = ["coordinate", "restatement", "distinct", "contrary"];

export const GROUP_HEADINGS: Record<RelGroup, string> = {
  coordinate: "Coordinate",
  restatement: "Support by restatement",
  distinct: "Support by distinct statement",
  contrary: "Support by contrary statement",
};

/**
 * Piper draws Negative-Positive as a stroke rather than lettering, so the
 * renderer special cases this value. Written as an escape so the source file
 * stays ASCII: U+2212 MINUS SIGN, which is what the mockup's &minus; is.
 */
export const NEG_POS_SYMBOL = "\u2212/+";

const GROUND_INFERENCE_WARNING =
  "Piper, p. 34: do not mix these two up. In Ground the conclusion comes first; in Inference it comes second.";

const pair = { minMembers: 2, maxMembers: 2, requiresCircle: false } as const;
const openCoordinate = { minMembers: 2, maxMembers: null, requiresCircle: false } as const;

export const RELATIONSHIPS: readonly Relationship[] = [
  { code: "S", name: "Series", symbol: "S", group: "coordinate", ...openCoordinate,
    definition: "Each proposition makes its own independent contribution to a whole." },
  { code: "P", name: "Progression", symbol: "P", group: "coordinate", ...openCoordinate,
    definition: "Like series, but each proposition is a further step toward a climax." },
  { code: "A", name: "Alternative", symbol: "A", group: "coordinate", ...openCoordinate,
    definition: "Each proposition expresses a different possibility arising from a situation." },

  { code: "AcMn", name: "Action-Manner", symbol: "Ac/Mn", group: "restatement", ...pair,
    definition: "An action and a statement indicating the way or manner that action is carried out." },
  { code: "Cf", name: "Comparison", symbol: "Cf", group: "restatement", ...pair,
    definition: "An action and a statement that clarifies that action by showing what it is like." },
  { code: "NegPos", name: "Negative-Positive", symbol: NEG_POS_SYMBOL, group: "restatement", ...pair,
    definition: "Two statements, one of which is denied so that the other is enforced." },
  { code: "IdExp", name: "Idea-Explanation", symbol: "Id/Exp", group: "restatement", ...pair,
    definition: "The relationship between an original statement and one clarifying its meaning." },
  { code: "QA", name: "Question-Answer", symbol: "Q/A", group: "restatement", ...pair,
    definition: "The statement of a question and the answer to that question." },

  { code: "G", name: "Ground", symbol: "G", group: "distinct", ...pair,
    definition: "A statement and the argument or reason for that statement (supporting proposition follows).",
    warning: GROUND_INFERENCE_WARNING },
  // U+2234 THEREFORE, Piper's inference sign.
  { code: "Inf", name: "Inference", symbol: "\u2234", group: "distinct", ...pair,
    definition: "A statement and the argument or reason for that statement (supporting proposition precedes).",
    warning: GROUND_INFERENCE_WARNING },
  { code: "BL", name: "Bilateral", symbol: "BL", group: "distinct",
    minMembers: 3, maxMembers: 3, requiresCircle: false,
    definition: "A proposition that supports two other propositions, one preceding and one following." },
  { code: "AcRes", name: "Action-Result", symbol: "Ac/Res", group: "distinct",
    minMembers: 2, maxMembers: 2, requiresCircle: true,
    definition: "An action and a consequence or result which accompanies that action." },
  { code: "AcPur", name: "Action-Purpose", symbol: "Ac/Pur", group: "distinct",
    minMembers: 2, maxMembers: 2, requiresCircle: true,
    definition: "An action and its intended result." },
  { code: "IfTh", name: "Conditional", symbol: "If/Th", group: "distinct", ...pair,
    definition: "Like Action-Result except that the existence of the action is only potential and the result is contingent upon that action." },
  { code: "T", name: "Temporal", symbol: "T", group: "distinct", ...pair,
    definition: "A statement and the occasion when it is true or can occur." },
  { code: "L", name: "Locative", symbol: "L", group: "distinct", ...pair,
    definition: "A statement and the place where it is true or can occur." },

  { code: "Csv", name: "Concessive", symbol: "Csv", group: "contrary", ...pair,
    definition: "A main clause that stands despite a contrary statement." },
  { code: "SitR", name: "Situation-Response", symbol: "Sit/R", group: "contrary",
    minMembers: 2, maxMembers: 2, requiresCircle: true,
    definition: "A situation and its surprising or counter-intuitive response." },
];

export const CIRCLING_CODES: readonly RelCode[] = RELATIONSHIPS.filter((r) => r.requiresCircle).map((r) => r.code);

const BY_CODE = new Map(RELATIONSHIPS.map((r) => [r.code, r]));

export function relationship(code: RelCode): Relationship {
  const found = BY_CODE.get(code);
  if (!found) throw new Error(`unknown relationship: ${code}`);
  return found;
}

/**
 * The one place the member-count rule lives: compared against both
 * minMembers and maxMembers, so a relationship whose min differs from its
 * max is still handled correctly, not just the exactly-two and
 * exactly-three shapes RELATIONSHIPS uses today. arcTree.ts's canRelate
 * and relabelArc, and validate.ts's validateDoc, all call this rather than
 * each restating the boundary check.
 */
export function memberCountFit(rel: Relationship, n: number): { ok: boolean; reason?: string } {
  const fits = n >= rel.minMembers && (rel.maxMembers === null || n <= rel.maxMembers);
  if (fits) return { ok: true };
  if (rel.maxMembers === null) return { ok: false, reason: `Takes ${rel.minMembers} or more` };
  if (rel.maxMembers === rel.minMembers) return { ok: false, reason: `Takes exactly ${rel.minMembers}` };
  return { ok: false, reason: `Takes ${rel.minMembers} to ${rel.maxMembers}` };
}
