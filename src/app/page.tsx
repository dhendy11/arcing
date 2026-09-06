"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { listArcs } from "@/client/api";
import { NewArcSheet } from "@/components/NewArcSheet";
import { SeriesList } from "@/components/SeriesList";
import type { ArcSummary } from "@/core/types";

type LoadState = "loading" | "loaded" | "failed";

export default function SeriesPage() {
  const router = useRouter();
  const [items, setItems] = useState<ArcSummary[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    void (async () => {
      let result: ArcSummary[] | "unauthorized";
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
      if (!Array.isArray(result)) {
        setLoadState("failed");
        return;
      }
      setItems(result);
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
        <SeriesList items={items} onOpen={(id) => router.push(`/a/${id}/split`)} onNew={() => setSheetOpen(true)} />
      )}
      {sheetOpen ? (
        <NewArcSheet onCreated={(doc) => router.push(`/a/${doc.id}/split`)} onClose={() => setSheetOpen(false)} />
      ) : null}
    </main>
  );
}
