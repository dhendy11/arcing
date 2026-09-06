"use client";

import { useState } from "react";
import { completionMissing, deriveStatus } from "@/core/status";
import type { ArcDoc, Level, Summary } from "@/core/types";

/** The topmost level has nothing above it, so its connector is always "". */
function normalizeLevels(levels: Level[]): Level[] {
  return levels.map((level, i) => (i === levels.length - 1 ? { ...level, connector: "" } : level));
}

export function SummarizeView({ doc, onChange }: { doc: ArcDoc; onChange: (doc: ArcDoc) => void }) {
  const missing = completionMissing(doc);
  const levels = doc.summary.levels;

  // Confirm before a Remove that would discard written text. Tracks which
  // doc it was raised against for the same reason SplitView's pending
  // split/rejoin does: an Undo/Redo landing while this is open must not let
  // a stale index apply to a document the level no longer describes. This
  // is React's documented adjusting-state-during-render pattern, not a
  // useEffect (the project's react-hooks/set-state-in-effect rule rejects
  // an effect that calls setState unconditionally in its body).
  const [pendingRemove, setPendingRemove] = useState<number | null>(null);
  const [pendingForDoc, setPendingForDoc] = useState(doc);
  if (doc !== pendingForDoc) {
    setPendingForDoc(doc);
    setPendingRemove(null);
  }

  function withSummary(summary: Summary): void {
    const next: ArcDoc = { ...doc, summary: { ...summary, levels: normalizeLevels(summary.levels) } };
    onChange({ ...next, status: deriveStatus(next) });
  }

  function setLevels(nextLevels: Level[]): void {
    withSummary({ ...doc.summary, levels: nextLevels });
  }

  function requestRemove(index: number): void {
    const level = levels[index];
    if (level.text.trim() || level.connector.trim()) {
      setPendingRemove(index);
    } else {
      setLevels(levels.filter((_, i) => i !== index));
    }
  }

  return (
    <div className="summarize-screen">
      <label htmlFor="main-point">Main point</label>
      <input
        id="main-point"
        value={doc.summary.mainPoint}
        onChange={(e) => withSummary({ ...doc.summary, mainPoint: e.target.value })}
      />

      <section className="levels">
        <h2>The argument, bottom to top</h2>
        {/*
          Piper's argument is bottom to top (levels[0] is the bottom), but a
          page reads top to bottom, so the DISPLAY order is reversed here
          while every id, label and callback keeps the REAL array index: a
          reversed .map would have "Move level 1 up" move level 1 visibly
          DOWN the screen, which is the one thing about the only reorder
          control a user cannot reason their way out of. The connector for
          level i renders BEFORE that level's own text so it prints right
          below the row for level i+1 that it connects into, sitting as the
          visual seam between the two rows it joins rather than trailing the
          row it belongs to.
        */}
        {levels
          .map((level, index) => ({ level, index }))
          .reverse()
          .map(({ level, index }) => (
            <div key={index} className="level">
              {index === levels.length - 1 ? null : (
                <>
                  <label htmlFor={`connector-${index + 1}`}>{`Connector above level ${index + 1}`}</label>
                  <input
                    id={`connector-${index + 1}`}
                    value={level.connector}
                    onChange={(e) =>
                      setLevels(levels.map((l, i) => (i === index ? { ...l, connector: e.target.value } : l)))
                    }
                  />
                </>
              )}

              <label htmlFor={`level-${index + 1}`}>{`Level ${index + 1}`}</label>
              <input
                id={`level-${index + 1}`}
                value={level.text}
                onChange={(e) =>
                  setLevels(levels.map((l, i) => (i === index ? { ...l, text: e.target.value } : l)))
                }
              />

              <button
                type="button"
                aria-label={`Move level ${index + 1} up`}
                disabled={index === levels.length - 1}
                onClick={() => {
                  const next = [...levels];
                  [next[index], next[index + 1]] = [next[index + 1], next[index]];
                  setLevels(next);
                }}
              >
                Up
              </button>
              <button
                type="button"
                aria-label={`Remove level ${index + 1}`}
                onClick={() => requestRemove(index)}
              >
                Remove
              </button>
            </div>
          ))}
        <button type="button" onClick={() => setLevels([...levels, { text: "", connector: "" }])}>
          Add level
        </button>
      </section>

      {pendingRemove === null ? null : (
        <div className="modal" role="dialog" aria-label="This removes what you wrote">
          <p>{`Level ${pendingRemove + 1}'s text is gone if you remove it.`}</p>
          <div className="modal-actions">
            <button type="button" onClick={() => setPendingRemove(null)}>
              Cancel
            </button>
            <button
              type="button"
              className="destructive"
              onClick={() => {
                setLevels(levels.filter((_, i) => i !== pendingRemove));
                setPendingRemove(null);
              }}
            >
              Remove anyway
            </button>
          </div>
        </div>
      )}

      <label htmlFor="why">Why it matters</label>
      <input
        id="why"
        value={doc.summary.whyItMatters}
        onChange={(e) => withSummary({ ...doc.summary, whyItMatters: e.target.value })}
      />

      {missing.length === 0 ? null : (
        <ul className="missing" data-testid="missing-list">
          {missing.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}

      <button
        type="button"
        disabled={missing.length > 0}
        onClick={() => {
          const next: ArcDoc = { ...doc, markedComplete: true };
          onChange({ ...next, status: deriveStatus(next) });
        }}
      >
        Mark complete
      </button>
    </div>
  );
}
