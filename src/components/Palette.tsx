"use client";

import { canRelabel, canRelate, selectionFit } from "@/core/arcTree";
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
  /*
    A selection-level block (nothing selected, or a gap between the units) is
    ONE fact about the selection: it is the same answer on all 18 rows and
    says nothing about any relationship. It reads once, above the groups, and
    the rows are left at full strength. Relabelling never carries one, since
    an arc's own members are adjacent by construction.
  */
  const block = relabelArcId === null ? selectionFit(doc, units) : { ok: true as const };

  return (
    <div className="palette">
      {block.ok ? null : (
        <p className="palette-block" data-testid="palette-block">
          {block.reason}
        </p>
      )}

      {GROUP_ORDER.map((group) => {
        const rows = RELATIONSHIPS.filter((rel) => rel.group === group);
        return (
          <section key={group} className="palette-group">
            <h4>{GROUP_HEADINGS[group]}</h4>
            {rows.map((rel, index) => {
              // Only asked once the selection itself is relatable, so what
              // comes back is the row's own member-count answer.
              const fit = block.ok
                ? relabelArcId
                  ? canRelabel(doc, relabelArcId, rel.code)
                  : canRelate(doc, units, rel.code)
                : null;
              const unfit = fit !== null && !fit.ok;
              const isCurrent = relabelArcId !== null && currentCode === rel.code;
              /*
                Piper's page 34 warning belongs to the Ground and Inference
                PAIR, so it prints once, under the last row in the group
                carrying it, where it reads as a note on both. Driven by the
                warning field itself, never by a hardcoded relationship code.
              */
              const lastCarryingWarning =
                rel.warning !== undefined &&
                !rows.slice(index + 1).some((later) => later.warning === rel.warning);

              return (
                <div key={rel.code} className="palette-row">
                  <button
                    type="button"
                    data-testid={`rel-${rel.code}`}
                    data-rel={rel.code}
                    data-current={isCurrent}
                    data-unfit={unfit}
                    aria-pressed={relabelArcId === null ? undefined : isCurrent}
                    disabled={fit === null || !fit.ok}
                    onClick={() => onPick(rel.code)}
                  >
                    <span className="sym">{rel.symbol}</span>
                    <span className="name">
                      {rel.name}
                      {rel.requiresCircle ? <span className="ring">circle one</span> : null}
                    </span>
                    <span className="def">{rel.definition}</span>
                    {unfit ? <span className="why">{fit.reason}</span> : null}
                  </button>
                  {lastCarryingWarning ? (
                    <p className="warn" data-testid="ground-inference-warning">
                      {rel.warning}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}
