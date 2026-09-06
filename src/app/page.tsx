"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { listArcs } from "@/client/api";
import { NewArcSheet } from "@/components/NewArcSheet";
import { SeriesList } from "@/components/SeriesList";
import type { ArcSummary } from "@/core/types";

export default function SeriesPage() {
  const router = useRouter();
  const [items, setItems] = useState<ArcSummary[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    void (async () => {
      const result = await listArcs();
      if (result === "unauthorized") {
        router.push("/login");
        return;
      }
      setItems(result);
    })();
  }, [router]);

  return (
    <main className="page">
      <SeriesList items={items} onOpen={(id) => router.push(`/a/${id}/split`)} onNew={() => setSheetOpen(true)} />
      {sheetOpen ? (
        <NewArcSheet onCreated={(doc) => router.push(`/a/${doc.id}/split`)} onClose={() => setSheetOpen(false)} />
      ) : null}
    </main>
  );
}
