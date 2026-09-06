import { ArcWorkspace } from "@/components/ArcWorkspace";

export default async function SplitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ArcWorkspace id={id} tab="split" />;
}
