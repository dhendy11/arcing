"use client";

import { useArcStore } from "@/client/store";
import { useArcEdit } from "@/components/ArcWorkspace";
import { SplitView } from "@/components/SplitView";

export default function SplitPage() {
  const doc = useArcStore((s) => s.doc);
  const edit = useArcEdit();
  if (!doc) return null;
  return <SplitView doc={doc} onChange={edit} />;
}
