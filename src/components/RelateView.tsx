"use client";

import { useState } from "react";
import { useArcStore } from "@/client/store";
import {
  arcsDissolvedByDissolve,
  createArc,
  dissolveArc,
  relabelArc,
  setCircled,
} from "@/core/arcTree";
import { relationship, type RelCode } from "@/core/relationships";
import { arcById, memberKey, propIndexRange } from "@/core/tree";
import type { ArcDoc, Member } from "@/core/types";
import { ArcSvg } from "./ArcSvg";
import { Palette } from "./Palette";

/** The missing-circle prompt, quoting Piper p. 22 (RULED 2026-11-02). */
const CIRCLE_PROMPT =
  "Circle the half that is primary in the author's mind. Piper circles the Purpose in Romans 12:2 " +
  '"because that is primary in Paul\'s mind; it is the goal, the main point."';

/** How a member reads in the circle controls: the diagram's own numbering. */
function memberLabel(doc: ArcDoc, member: Member): string {
  if (member.kind === "prop") {
    return `Proposition ${doc.propositions.findIndex((p) => p.id === member.ref) + 1}`;
  }
  const node = arcById(doc, member.ref);
  const range = propIndexRange(doc, member);
  const name = node ? relationship(node.rel).name : member.ref;
  return `${name} over ${range.first + 1} to ${range.last + 1}`;
}

export function RelateView({ doc, onChange }: { doc: ArcDoc; onChange: (doc: ArcDoc) => void }) {
  const selection = useArcStore((s) => s.selection);
  const setSelection = useArcStore((s) => s.setSelection);
  const [relabelling, setRelabelling] = useState<string | null>(null);
  /** The arc whose dissolve is waiting on the confirm dialog. */
  const [pendingDissolve, setPendingDissolve] = useState<string | null>(null);
  /*
    The propositions and arcs the two pieces of pending state were computed
    against, compared by VALUE, not by the whole doc's reference. ArcFrame
    installs a document-level Undo/Redo shortcut this component does not
    suppress, so the document can change out from under an open relabel or an
    open confirm dialog; without this, the sheet would keep reading as a
    relabel in progress on an arc that no longer exists, and the dialog would
    list arcs the document may no longer describe. Comparing `doc` itself by
    reference would be worse than nothing: a completed autosave hands back a
    freshly parsed object on every save tick, so an ordinary save would
    dismiss the dialog with nothing to invalidate it. This is React's
    documented pattern for resetting state when a prop changes (adjusting
    state during render), not a useEffect, whose unconditional setState the
    project's own lint rule rejects. SplitView solves the same class the same
    way.
  */
  const [stateForDoc, setStateForDoc] = useState(doc);
  if (
    JSON.stringify(doc.propositions) !== JSON.stringify(stateForDoc.propositions) ||
    JSON.stringify(doc.arcs) !== JSON.stringify(stateForDoc.arcs)
  ) {
    setStateForDoc(doc);
    setRelabelling(null);
    setPendingDissolve(null);
  }

  const focusedArc = selection.length === 1 && selection[0].kind === "arc" ? selection[0].ref : null;
  const focusedNode = focusedArc === null ? undefined : arcById(doc, focusedArc);
  const focusedRel = focusedNode ? relationship(focusedNode.rel) : null;

  function toggle(unit: Member): void {
    const key = memberKey(unit);
    const already = selection.some((u) => memberKey(u) === key);
    setSelection(already ? selection.filter((u) => memberKey(u) !== key) : [...selection, unit]);
    setRelabelling(null);
  }

  /**
   * RULING 1, AMENDED 2026-11-02. layout() places an arc's own LABEL target
   * and its parent's CIRCLE target for that member at the identical point,
   * because a circled member arc is circled on its own symbol, which is
   * Piper's reading. The parent's circle target is drawn later, so it is the
   * one a tap there reaches, and which of the two actions the tap means is
   * read from the selection, not from the pixel:
   *
   * - The PARENT is focused (selected alone, so its "Circled member" panel
   *   is open and asking which half): the tap circles the member arc, exactly
   *   as a tap circles a proposition member. Drew hit this on 2026-11-02:
   *   the panel asked which one, and tapping the member arc on the diagram
   *   selected it instead of answering.
   * - Anything else: the tap selects the member arc, so relabel and dissolve
   *   stay reachable on a nested arc, which has no other handle. To reach a
   *   member arc while its parent is focused, tap the parent's label first to
   *   let it go.
   *
   * Nothing is lost by the first case: selecting a member arc alongside its
   * own focused parent was never relatable. The panel's "Circled member"
   * buttons below stay as the fallback for the same action.
   */
  function circle(arcId: string, memberIndex: number): void {
    const node = arcById(doc, arcId);
    const member = node?.members[memberIndex];
    if (!member) return;
    if (member.kind === "arc" && focusedArc !== arcId) {
      toggle(member);
      return;
    }
    onChange(setCircled(doc, arcId, memberIndex));
  }

  function pick(code: RelCode): void {
    if (relabelling) {
      onChange(relabelArc(doc, relabelling, code));
      setRelabelling(null);
      setSelection([]);
      return;
    }
    onChange(createArc(doc, selection, code));
    setSelection([]);
  }

  return (
    <div className="relate-screen">
      {/* Always visible (RULED 2026-11-02): why every proposition already has an arc. */}
      <p className="relate-intro">
        Each proposition starts as its own arc (Piper p. 21). Join neighbours into larger arcs until one arc
        spans the passage.
      </p>

      {/*
        RULING 2, AMENDED 2026-11-02 (fill the page, option A). ArcSvg asks for
        width 100% against a 1024 unit viewBox, so a 44 unit target is 44 CSS
        px only while the SVG renders at 1024 px or wider. .arc-scroll in
        globals.css renders it at max(1024 px, the full window width): it
        scales UP to fill a wide screen and never drops below 1024 px, and on
        the 1024 px iPad it bleeds through the frame padding to the window
        edge so it fits with no sideways scroll. The scroll wrapper stays as
        the fallback for anything narrower.
      */}
      <div className="arc-scroll">
        <ArcSvg doc={doc} selection={selection} onSelectUnit={toggle} onCircle={circle} />
      </div>

      {focusedNode === undefined || focusedRel === null ? null : (
        <div className="arc-actions" role="group" aria-label={`Arc ${focusedNode.id}`}>
          <div className="arc-actions-row">
            <button
              type="button"
              aria-pressed={relabelling === focusedNode.id}
              onClick={() => setRelabelling(focusedNode.id)}
            >
              Relabel
            </button>
            {/*
              A dissolve takes the arc AND every arc above it apart, which is
              strictly more than a split does, and the split screen already
              confirms. Same gate, same dialog shape, same naming.
            */}
            <button
              type="button"
              className="destructive"
              onClick={() => setPendingDissolve(focusedNode.id)}
            >
              Dissolve
            </button>
          </div>

          {focusedRel.requiresCircle ? (
            <div className="circle-choice" role="group" aria-label="Circled member">
              <h4>Circled member</h4>
              {focusedNode.members.map((member, index) => (
                <button
                  key={memberKey(member)}
                  type="button"
                  data-testid={`circle-member-${index}`}
                  aria-pressed={focusedNode.circled === index}
                  onClick={() => onChange(setCircled(doc, focusedNode.id, index))}
                >
                  {memberLabel(doc, member)}
                </button>
              ))}
              {focusedNode.circled === null ? (
                <p className="circle-missing" data-testid="circle-missing">
                  {CIRCLE_PROMPT}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      )}

      {pendingDissolve === null ? null : (
        <div className="modal" role="dialog" aria-label="This dissolves arcs">
          <p>These arcs come apart:</p>
          <ul>
            {arcsDissolvedByDissolve(doc, pendingDissolve).map((id) => {
              const node = arcById(doc, id);
              return <li key={id}>{node ? `${id} (${relationship(node.rel).name})` : id}</li>;
            })}
          </ul>
          <div className="modal-actions">
            <button type="button" onClick={() => setPendingDissolve(null)}>
              Cancel
            </button>
            <button
              type="button"
              className="destructive"
              onClick={() => {
                onChange(dissolveArc(doc, pendingDissolve));
                setPendingDissolve(null);
                setSelection([]);
              }}
            >
              Dissolve anyway
            </button>
          </div>
        </div>
      )}

      <Palette
        doc={doc}
        units={selection}
        relabelArcId={relabelling}
        currentCode={focusedNode?.rel ?? null}
        onPick={pick}
      />
    </div>
  );
}
