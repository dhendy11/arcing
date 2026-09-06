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
        <p>Also, participles and infinitives become their own proposition when they assert something (p. 28).</p>
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
