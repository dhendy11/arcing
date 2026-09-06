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
   * RULING 1. layout() places an arc's own LABEL target and its parent's
   * CIRCLE target for that member at the identical point, because a circled
   * member arc is circled on its own symbol, which is Piper's reading. The
   * arc label owns that tap: relabel and dissolve are the structural actions
   * and must stay reachable, and a nested arc has no other handle. So the
   * callback is read rather than the pixel: a circle tap that lands on an ARC
   * member is a selection of that arc. The circle for an arc member is set
   * from the parent's own controls below, which is also the right owner,
   * since `circled` is a field on the PARENT.
   */
  function circle(arcId: string, memberIndex: number): void {
    const node = arcById(doc, arcId);
    const member = node?.members[memberIndex];
    if (!member) return;
    if (member.kind === "arc") {
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
      {/*
        RULING 2. ArcSvg asks for width 100% against a 1024 unit viewBox, so a
        44 unit target is only 44 CSS px while the SVG renders at exactly
        1024 px. Mockup A answers this itself: a fixed 1024 px diagram inside a
        horizontally scrollable wrapper, never a scale-to-fit, so the touch
        floor holds on the 1024 px iPad whatever padding the frame carries.
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
                  {focusedRel.name} circles one of its two members. Choose which.
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
