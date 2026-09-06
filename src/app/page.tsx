"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { listArcs, type ArcList } from "@/client/api";
import { NewArcSheet } from "@/components/NewArcSheet";
import { SeriesList } from "@/components/SeriesList";
import type { ArcSummary } from "@/core/types";

type LoadState = "loading" | "loaded" | "failed";

export default function SeriesPage() {
  const router = useRouter();
  const [items, setItems] = useState<ArcSummary[]>([]);
  const [unreadable, setUnreadable] = useState(0);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    void (async () => {
      let result: ArcList | "unauthorized";
      try {
        result = await listArcs();
      } catch {
        setLoadState("failed");
        return;
      }
      if (result === "unauthorized") {
        router.push("/login");
        return;
      }
      // The cast is the point: an error body is not an ArcList whatever the
      // signature says, so the rows are checked at runtime before they are
      // trusted, the same guard the bare-array shape had.
      const list = result as Partial<ArcList> | null;
      if (!Array.isArray(list?.arcs)) {
        setLoadState("failed");
        return;
      }
      setItems(list.arcs);
      setUnreadable(Array.isArray(list.unreadable) ? list.unreadable.length : 0);
      setLoadState("loaded");
    })();
  }, [router]);

  return (
    <main className="page">
      {loadState === "loading" ? (
        <p className="empty">Loading arcs.</p>
      ) : loadState === "failed" ? (
        <p className="empty">Could not load your arcs.</p>
      ) : (
        <>
          {/* An arc file the server could not read is left out of the list
              below. There is no delete affordance in this app, so an
              unexplained absence reads as an arc that vanished; this line
              is the only signal that one is missing. */}
          {unreadable > 0 ? (
            <div role="alert" className="banner">
              <span>
                {unreadable === 1
                  ? "1 arc could not be read and is not listed."
                  : `${unreadable} arcs could not be read and are not listed.`}
              </span>
            </div>
          ) : null}
          <SeriesList items={items} onOpen={(id) => router.push(`/a/${id}/split`)} onNew={() => setSheetOpen(true)} />
        </>
      )}
      {sheetOpen ? (
        <NewArcSheet onCreated={(doc) => router.push(`/a/${doc.id}/split`)} onClose={() => setSheetOpen(false)} />
      ) : null}
    </main>
  );
}
