import { relationship } from "./relationships";
import { propIndexRange, unitLevel } from "./tree";
import type { ArcDoc, Member } from "./types";

/**
 * Only the paper-style stacked layout exists in v1 (RULED 2026-09-05 11:55).
 * The biblearc mode stays specified in the design doc and is a second branch
 * behind this same signature when it is ruled in.
 */
export type LayoutMode = "stacked";

export interface PropBox {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  lines: string[];
}

export interface ArcCircle {
  memberIndex: number;
  x: number;
  y: number;
}

export interface ArcShape {
  id: string;
  d: string;
  sym: string;
  labelX: number;
  labelY: number;
  circles: ArcCircle[];
}

/** Piper draws an arc over every proposition, not only over relationships. */
export interface LeafShape {
  propId: string;
  d: string;
}

export interface Baseline {
  x: number;
  y0: number;
  y1: number;
  ticks: number[];
}

export interface Geometry {
  width: number;
  height: number;
  props: PropBox[];
  arcs: ArcShape[];
  leaves: LeafShape[];
  baseline: Baseline;
}

/**
 * Read off mockups/arcing-layouts.html section A, which is the geometry
 * authority. Every value here is a measurement off that SVG except MAX_CHARS.
 *
 * MAX_CHARS 58 is a CHARACTER PROXY for pixel width, not a measurement. It is
 * the budget that reproduces mockup A's exact line breaks, and it was fitted
 * against the face that mockup renders proposition text in, which is the
 * system SANS stack at 17 px in a 528 px column (its CSS sets svg text to
 * -apple-system and never overrides it for .p). The spec's binding type rule
 * is sans chrome and SERIF passage text, so the renderer will NOT use that
 * face. A 58-character serif line is not 528 px wide, and any line that
 * overflows the column runs into the baseline stroke at BASELINE_X. Re-check
 * this budget against a real serif render and re-derive it if it overflows.
 * Changing it changes every row height and therefore every arc, so it is a
 * layout decision and not a renderer tweak.
 */
export const LAYOUT = {
  WIDTH: 1024,
  /** Right edge of the proposition-number gutter. */
  NUMBER_X: 68,
  TEXT_X: 84,
  BASELINE_X: 612,
  TOP: 16,
  LINE_HEIGHT: 24,
  ROW_PAD: 24,
  /** First text baseline, measured down from the row's top edge. */
  FIRST_BASELINE: 30,
  MAX_CHARS: 58,
  LEAF_RX: 48,
  LANE_STEP: 56,
  LABEL_LANE_0: 26,
  LABEL_LANE_1: 78,
  /** Text baselines sit 6 px below the point they label. */
  LABEL_BASELINE: 6,
  TICK: 14,
  BOTTOM_PAD: 20,
} as const;

/**
 * Greedy wrap on a character budget. A word longer than the budget gets its
 * own line uncut.
 *
 * Characters are a PROXY for pixel width, fitted to one passage in one font
 * family (see LAYOUT.MAX_CHARS for which one, and why it is not the face the
 * renderer will use). A line of wide glyphs therefore overflows the column
 * and a line of narrow ones underfills it. src/core is DOM-free by
 * constraint and cannot measure text, which is why this counts rather than
 * measures.
 */
export function wrapLines(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if (line === "") {
      line = word;
    } else if (line.length + 1 + word.length <= maxChars) {
      line = `${line} ${word}`;
    } else {
      lines.push(line);
      line = word;
    }
  }
  lines.push(line);
  return lines;
}

function arcPath(y0: number, y1: number, rx: number): string {
  return `M${LAYOUT.BASELINE_X} ${y0} A${rx} ${(y1 - y0) / 2} 0 0 1 ${LAYOUT.BASELINE_X} ${y1}`;
}

function rxFor(level: number): number {
  return LAYOUT.LEAF_RX + LAYOUT.LANE_STEP * level;
}

/**
 * Where a unit's own lettering sits: inside its own arc's bulge, clear of
 * every smaller arc. Level 0 is the leaf lane.
 */
function laneOffset(level: number): number {
  return level === 0 ? LAYOUT.LABEL_LANE_0 : LAYOUT.LABEL_LANE_1 + LAYOUT.LANE_STEP * (level - 1);
}

export function layout(doc: ArcDoc, mode: LayoutMode): Geometry {
  if (mode !== "stacked") throw new Error(`unknown layout mode: ${mode}`);

  const props: PropBox[] = [];
  let y = LAYOUT.TOP;
  for (const p of doc.propositions) {
    const lines = wrapLines(p.text, LAYOUT.MAX_CHARS);
    const h = lines.length * LAYOUT.LINE_HEIGHT + LAYOUT.ROW_PAD;
    props.push({ id: p.id, x: LAYOUT.TEXT_X, y, w: LAYOUT.BASELINE_X - LAYOUT.TEXT_X, h, lines });
    y += h;
  }

  const bottom = props.length > 0 ? props[props.length - 1].y + props[props.length - 1].h : LAYOUT.TOP;

  const spanOf = (unit: Member): { y0: number; y1: number } => {
    const range = propIndexRange(doc, unit);
    const first = props[range.first];
    const last = props[range.last];
    if (!first || !last) return { y0: LAYOUT.TOP, y1: LAYOUT.TOP };
    return { y0: first.y, y1: last.y + last.h };
  };

  const leaves: LeafShape[] = props.map((b) => ({
    propId: b.id,
    d: arcPath(b.y, b.y + b.h, LAYOUT.LEAF_RX),
  }));

  const arcs: ArcShape[] = doc.arcs.map((a) => {
    const unit: Member = { kind: "arc", ref: a.id };
    const level = unitLevel(doc, unit);
    const { y0, y1 } = spanOf(unit);
    const rel = relationship(a.rel);
    return {
      id: a.id,
      d: arcPath(y0, y1, rxFor(level)),
      sym: rel.symbol,
      labelX: LAYOUT.BASELINE_X + laneOffset(level),
      labelY: (y0 + y1) / 2 + LAYOUT.LABEL_BASELINE,
      circles: rel.requiresCircle
        ? a.members.map((m, memberIndex) => {
            const span = spanOf(m);
            return {
              memberIndex,
              x: LAYOUT.BASELINE_X + laneOffset(unitLevel(doc, m)),
              y: (span.y0 + span.y1) / 2,
            };
          })
        : [],
    };
  });

  return {
    width: LAYOUT.WIDTH,
    height: bottom + LAYOUT.BOTTOM_PAD,
    props,
    arcs,
    leaves,
    baseline: { x: LAYOUT.BASELINE_X, y0: LAYOUT.TOP, y1: bottom, ticks: [LAYOUT.TOP, ...props.map((b) => b.y + b.h)] },
  };
}
