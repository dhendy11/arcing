"use client";

import type { ArcSummary } from "@/core/types";

export function SeriesList({
  items,
  onOpen,
  onNew,
}: {
  items: ArcSummary[];
  onOpen: (id: string) => void;
  onNew: () => void;
}) {
  const sorted = [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <section className="series">
      <header className="series-head">
        <h1>Arcs</h1>
        <button type="button" onClick={onNew}>
          New arc
        </button>
      </header>

      {sorted.length === 0 ? (
        <p className="empty">No arcs yet. Start one.</p>
      ) : (
        <ul className="series-rows">
          {sorted.map((item) => (
            <li key={item.id}>
              <button type="button" onClick={() => onOpen(item.id)}>
                {/* The id's own date prefix, never the UTC day off
                    createdAt. The id is filed in America/New_York
                    (src/app/api/arcs/route.ts) so a Saturday-night arc is
                    filed on Saturday; the timestamp would print Sunday for
                    anything made after 20:00 ET and undo that on the one
                    surface where the dated series is the point. */}
                <span className="date">{item.id.slice(0, 10)}</span>
                <span className="reference">{item.reference}</span>
                <span className="status">{item.status}</span>
                <span className="main-point">{item.mainPoint}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
