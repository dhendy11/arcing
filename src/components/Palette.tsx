"use client";

import { canRelabel, canRelate } from "@/core/arcTree";
import { GROUP_HEADINGS, GROUP_ORDER, RELATIONSHIPS, type RelCode } from "@/core/relationships";
import type { ArcDoc, Member } from "@/core/types";

/**
 * All 18 on screen at once, in Piper's four groups, each with its one line
 * definition. This is the whole reason the tool exists rather than Biblearc:
 * choosing a label is comparing candidates, not recalling a name. Nothing
 * here is ever hidden, collapsed behind a menu, or filtered down to the
 * rows that fit. A row that does not fit is disabled and says why.
 */
export function Palette({
  doc,
  units,
  relabelArcId = null,
  currentCode = null,
  onPick,
}: {
  doc: ArcDoc;
  units: Member[];
  /** Set while relabelling an existing arc; fit is then judged on its members. */
  relabelArcId?: string | null;
  /** The label the arc being relabelled carries now, marked as the active row. */
  currentCode?: RelCode | null;
  onPick: (code: RelCode) => void;
}) {
  return (
    <div className="palette">
      {GROUP_ORDER.map((group) => (
        <section key={group} className="palette-group">
          <h4>{GROUP_HEADINGS[group]}</h4>
          {RELATIONSHIPS.filter((rel) => rel.group === group).map((rel) => {
            const fit = relabelArcId
              ? canRelabel(doc, relabelArcId, rel.code)
              : canRelate(doc, units, rel.code);
            const isCurrent = relabelArcId !== null && currentCode === rel.code;
            return (
              <div key={rel.code} className="palette-row">
                <button
                  type="button"
                  data-testid={`rel-${rel.code}`}
                  data-rel={rel.code}
                  data-current={isCurrent}
                  aria-pressed={relabelArcId === null ? undefined : isCurrent}
                  disabled={!fit.ok}
                  onClick={() => onPick(rel.code)}
                >
                  <span className="sym">{rel.symbol}</span>
                  <span className="name">
                    {rel.name}
                    {rel.requiresCircle ? <span className="ring">circle one</span> : null}
                  </span>
                  <span className="def">{rel.definition}</span>
                  {fit.ok ? null : <span className="why">{fit.reason}</span>}
                </button>
                {/*
                  Piper's page 34 warning belongs to the Ground and Inference
                  PAIR, not to either one alone, so it is printed once, under
                  the second of the two, where it reads as a note on both.
                */}
                {rel.code === "Inf" && rel.warning ? (
                  <p className="warn" data-testid="ground-inference-warning">
                    {rel.warning}
                  </p>
                ) : null}
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
}
