"use client";

import { useState } from "react";
import { relationship } from "@/core/relationships";
import { arcsDissolvedByRejoin, arcsDissolvedBySplit, rejoinAt, splitAt, wordStarts } from "@/core/split";
import type { ArcDoc } from "@/core/types";

interface Token {
  start: number;
  word: string;
}

function tokensOf(text: string): Token[] {
  const starts = wordStarts(text);
  return starts.map((start, i) => ({
    start,
    word: text.slice(start, i + 1 < starts.length ? starts[i + 1] : text.length).trimEnd(),
  }));
}

type Pending = { kind: "split"; at: number; arcs: string[] } | { kind: "rejoin"; propId: string; arcs: string[] };

export function SplitView({ doc, onChange }: { doc: ArcDoc; onChange: (doc: ArcDoc) => void }) {
  const [pending, setPending] = useState<Pending | null>(null);
  // Tracks the propositions/arcs `pending` was computed against, compared
  // by VALUE, not by the whole doc's reference. ArcFrame installs a
  // document-level Undo/Redo shortcut that this component does not
  // suppress, so the document can change out from under an open confirm
  // modal; without this, "Split/Rejoin anyway" would apply a stale
  // at/propId to a document the listed arcs may no longer describe. A
  // completed autosave also replaces `doc` with a freshly parsed object
  // (a new reference every time, even when nothing but rev/updatedAt
  // moved), so comparing `doc` itself by reference would dismiss the modal
  // on an ordinary save tick with nothing left to actually invalidate it;
  // JSON.stringify catches only the change that matters. This is React's
  // documented pattern for resetting state when a prop changes (adjusting
  // state during render), not a useEffect: an effect that calls setState
  // unconditionally in its body is a React anti-pattern the project's own
  // lint rule (react-hooks/set-state-in-effect) rejects.
  const [pendingForDoc, setPendingForDoc] = useState(doc);
  if (
    JSON.stringify(doc.propositions) !== JSON.stringify(pendingForDoc.propositions) ||
    JSON.stringify(doc.arcs) !== JSON.stringify(pendingForDoc.arcs)
  ) {
    setPendingForDoc(doc);
    setPending(null);
  }
  const tokens = tokensOf(doc.passage.text);
  const verseAt = new Map(doc.passage.verses.map((v) => [v.start, v.n]));

  function apply(action: Pending): void {
    onChange(action.kind === "split" ? splitAt(doc, action.at) : rejoinAt(doc, action.propId));
    setPending(null);
  }

  function requestSplit(at: number): void {
    if (doc.propositions.some((p) => p.start === at)) return;
    const arcs = arcsDissolvedBySplit(doc, at);
    const action: Pending = { kind: "split", at, arcs };
    if (arcs.length > 0) setPending(action);
    else apply(action);
  }

  function requestRejoin(propId: string): void {
    const arcs = arcsDissolvedByRejoin(doc, propId);
    const action: Pending = { kind: "rejoin", propId, arcs };
    if (arcs.length > 0) setPending(action);
    else apply(action);
  }

  return (
    <div className="split-screen">
      <aside className="rules">
        <h2>Piper on splitting</h2>
        <p>Relative clauses usually stay inside their proposition (p. 27).</p>
        <p>Participles and infinitives become their own proposition when they assert something (p. 28).</p>
      </aside>

      <ol className="propositions passage">
        {doc.propositions.map((p, index) => (
          <li key={p.id} data-proposition={p.id}>
            {index > 0 ? (
              <button
                type="button"
                className="divider"
                data-divider={p.id}
                aria-label={`Rejoin proposition ${index + 1} into ${index}`}
                onClick={() => requestRejoin(p.id)}
              >
                <span>X</span>
              </button>
            ) : null}

            <span className="number">{index + 1}</span>

            <span className="words">
              {tokens
                .filter((t) => t.start >= p.start && t.start < p.end)
                .map((t) => (
                  <button
                    key={t.start}
                    type="button"
                    className="word"
                    data-testid={`word-${t.start}`}
                    data-word-start={t.start}
                    onClick={() => requestSplit(t.start)}
                  >
                    {verseAt.has(t.start) ? (
                      <sup className="verse" data-testid={`verse-${verseAt.get(t.start)}`}>
                        {verseAt.get(t.start)}
                      </sup>
                    ) : null}
                    {t.word}
                  </button>
                ))}
            </span>
          </li>
        ))}
      </ol>

      {pending === null ? null : (
        <div className="modal" role="dialog" aria-label="This dissolves arcs">
          <p>These arcs come apart:</p>
          <ul>
            {pending.arcs.map((id) => {
              const node = doc.arcs.find((a) => a.id === id);
              return <li key={id}>{node ? `${id} (${relationship(node.rel).name})` : id}</li>;
            })}
          </ul>
          <div className="modal-actions">
            <button type="button" onClick={() => setPending(null)}>
              Cancel
            </button>
            <button type="button" className="destructive" onClick={() => apply(pending)}>
              {pending.kind === "split" ? "Split anyway" : "Rejoin anyway"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
