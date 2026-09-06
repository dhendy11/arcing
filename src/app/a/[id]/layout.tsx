import type { ReactNode } from "react";
import { ArcWorkspace } from "@/components/ArcWorkspace";

export default async function ArcLayout({
  params,
  children,
}: {
  params: Promise<{ id: string }>;
  children: ReactNode;
}) {
  const { id } = await params;
  return <ArcWorkspace id={id}>{children}</ArcWorkspace>;
}
