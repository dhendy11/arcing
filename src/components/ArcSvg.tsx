"use client";

import { LAYOUT, layout } from "@/core/layout";
import { NEG_POS_SYMBOL } from "@/core/relationships";
import { AMBER, COLORS } from "@/core/tokens";
import { memberKey } from "@/core/tree";
import type { ArcDoc, Member } from "@/core/types";

/** Half of the 44 px touch floor. */
const TARGET_R = 22;

/**
 * Piper's ring around a circled member, measured off mockups/arcing-layouts.html
 * section A (rx 21, ry 14; its 2.5 px stroke is .circle-ring in globals.css).
 * These are drawing constants, not geometry: nothing here is derived from the
 * document, which stays layout.ts's job.
 */
const CIRCLE_RX = 21;
const CIRCLE_RY = 14;

/** Mockup A draws Negative-Positive as a 24 px stroke centred on the label. */
const NEG_POS_HALF_W = 12;

export function ArcSvg({
  doc,
  selection,
  onSelectUnit,
  onCircle,
}: {
  doc: ArcDoc;
  selection: Member[];
  onSelectUnit: (unit: Member) => void;
  onCircle: (arcId: string, memberIndex: number) => void;
}) {
  const geometry = layout(doc, "stacked");
  const selected = new Set(selection.map(memberKey));

  return (
    <svg
      className="arc-svg"
      viewBox={`0 0 ${geometry.width} ${geometry.height}`}
      width="100%"
      role="img"
      aria-label={`${doc.passage.reference} arced`}
    >
      {/* proposition rows: text, number, and a full-width hit target */}
      {geometry.props.map((box, index) => {
        const isSelected = selected.has(`prop:${box.id}`);
        return (
          <g key={box.id}>
            <text x={LAYOUT.NUMBER_X} y={box.y + LAYOUT.FIRST_BASELINE} textAnchor="end" className="prop-number">
              {index + 1}
            </text>
            {box.lines.map((line, i) => (
              <text key={i} x={box.x} y={box.y + LAYOUT.FIRST_BASELINE + i * LAYOUT.LINE_HEIGHT} className="prop-text">
                {line}
              </text>
            ))}
            <rect
              data-prop={box.id}
              data-selected={isSelected}
              x={0}
              y={box.y}
              width={LAYOUT.BASELINE_X}
              height={box.h}
              fill={isSelected ? COLORS.accent : "transparent"}
              fillOpacity={isSelected ? 0.12 : 0}
              onClick={() => onSelectUnit({ kind: "prop", ref: box.id })}
            />
          </g>
        );
      })}

      {/* the baseline and its boundary ticks */}
      <path
        className="stroke"
        d={`M${geometry.baseline.x} ${geometry.baseline.y0} V${geometry.baseline.y1}`}
      />
      {geometry.baseline.ticks.map((y) => (
        <path key={y} className="stroke" d={`M${geometry.baseline.x - LAYOUT.TICK} ${y} H${geometry.baseline.x}`} />
      ))}

      {/* one arc over every proposition, Piper's own convention */}
      {geometry.leaves.map((leaf) => (
        <path key={leaf.propId} data-leaf={leaf.propId} className="stroke" d={leaf.d} />
      ))}

      {/* the relationship arcs, their symbols, and their circle targets */}
      {geometry.arcs.map((shape) => {
        const node = doc.arcs.find((a) => a.id === shape.id);
        if (!node) return null;
        const isSelected = selected.has(`arc:${shape.id}`);
        const missingCircle = shape.circles.length > 0 && node.circled === null;

        return (
          <g key={shape.id} data-arc-group={shape.id} data-selected={isSelected}>
            {/*
              Selection recolours this path from globals.css, not from a stroke
              attribute here: an SVG presentation attribute sits below every CSS
              rule in the cascade, so .arc-svg .stroke would paint it ink again.
              Verified in headless Chromium.
            */}
            <path className="stroke" d={shape.d} />

            {shape.sym === NEG_POS_SYMBOL ? (
              <path
                data-negpos="true"
                className="stroke"
                d={`M${shape.labelX - NEG_POS_HALF_W} ${shape.labelY - LAYOUT.LABEL_BASELINE} H${shape.labelX + NEG_POS_HALF_W}`}
              />
            ) : (
              <text x={shape.labelX} y={shape.labelY} textAnchor="middle" className="arc-symbol">
                {shape.sym}
              </text>
            )}

            {/*
              The arc's own hit target is this circle on its label, never the
              whole group: a group's bounding box is mostly empty, so a real
              browser click at its centre lands on whatever is painted there.
            */}
            <circle
              data-arc={shape.id}
              data-selected={isSelected}
              cx={shape.labelX}
              cy={shape.labelY - LAYOUT.LABEL_BASELINE}
              r={TARGET_R}
              fill="transparent"
              onClick={() => onSelectUnit({ kind: "arc", ref: shape.id })}
            />

            {shape.circles.map((circle) => {
              const isCircled = node.circled === circle.memberIndex;
              return (
                <g key={circle.memberIndex}>
                  {isCircled ? (
                    <ellipse cx={circle.x} cy={circle.y} rx={CIRCLE_RX} ry={CIRCLE_RY} className="stroke circle-ring" />
                  ) : null}
                  <circle
                    data-circle={`${shape.id}:${circle.memberIndex}`}
                    data-circled={isCircled}
                    data-missing={missingCircle}
                    cx={circle.x}
                    cy={circle.y}
                    r={TARGET_R}
                    fill="transparent"
                    stroke={missingCircle ? AMBER : "transparent"}
                    strokeDasharray={missingCircle ? "3 3" : undefined}
                    onClick={(event) => {
                      event.stopPropagation();
                      onCircle(shape.id, circle.memberIndex);
                    }}
                  />
                </g>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}
