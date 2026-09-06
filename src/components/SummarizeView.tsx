"use client";

import { completionMissing, deriveStatus } from "@/core/status";
import type { ArcDoc, Level, Summary } from "@/core/types";

/** The topmost level has nothing above it, so its connector is always "". */
function normalizeLevels(levels: Level[]): Level[] {
  return levels.map((level, i) => (i === levels.length - 1 ? { ...level, connector: "" } : level));
}

export function SummarizeView({ doc, onChange }: { doc: ArcDoc; onChange: (doc: ArcDoc) => void }) {
  const missing = completionMissing(doc);
  const levels = doc.summary.levels;

  function withSummary(summary: Summary): void {
    const next: ArcDoc = { ...doc, summary: { ...summary, levels: normalizeLevels(summary.levels) } };
    onChange({ ...next, status: deriveStatus(next) });
  }

  function setLevels(nextLevels: Level[]): void {
    withSummary({ ...doc.summary, levels: nextLevels });
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
        {levels.map((level, index) => (
          <div key={index} className="level">
            <label htmlFor={`level-${index + 1}`}>{`Level ${index + 1}`}</label>
            <input
              id={`level-${index + 1}`}
              value={level.text}
              onChange={(e) =>
                setLevels(levels.map((l, i) => (i === index ? { ...l, text: e.target.value } : l)))
              }
            />

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
              onClick={() => setLevels(levels.filter((_, i) => i !== index))}
            >
              Remove
            </button>
          </div>
        ))}
        <button type="button" onClick={() => setLevels([...levels, { text: "", connector: "" }])}>
          Add level
        </button>
      </section>

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
