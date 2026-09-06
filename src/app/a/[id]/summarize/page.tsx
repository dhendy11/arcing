"use client";

import { useArcStore } from "@/client/store";
import { useArcEdit } from "@/components/ArcWorkspace";
import { SummarizeView } from "@/components/SummarizeView";

export default function SummarizePage() {
  const doc = useArcStore((s) => s.doc);
  const edit = useArcEdit();
  if (!doc) return null;
  return <SummarizeView doc={doc} onChange={edit} />;
}
