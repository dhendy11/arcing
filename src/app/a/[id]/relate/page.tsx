"use client";

import { useArcStore } from "@/client/store";
import { useArcEdit } from "@/components/ArcWorkspace";
import { RelateView } from "@/components/RelateView";

export default function RelatePage() {
  const doc = useArcStore((s) => s.doc);
  const edit = useArcEdit();
  if (!doc) return null;
  return <RelateView doc={doc} onChange={edit} />;
}
