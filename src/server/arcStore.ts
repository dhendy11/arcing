import { mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ArcDoc, ArcStatus } from "@/core/types";

export interface ArcSummary {
  id: string;
  reference: string;
  status: ArcStatus;
  createdAt: string;
  updatedAt: string;
  mainPoint: string;
}

/** Read at call time, not at module load, so tests can point it at a tmpdir. */
export function arcsDir(): string {
  return path.join(process.env.DATA_DIR ?? "./data", "arcs");
}

/** Arc ids are generated from a date and a slug; nothing else is legal. */
export function isSafeArcId(id: string): boolean {
  return /^[a-z0-9][a-z0-9-]*$/.test(id);
}

export async function listArcIds(): Promise<string[]> {
  try {
    const files = await readdir(arcsDir());
    return files.filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -".json".length));
  } catch {
    return [];
  }
}

export async function readArc(id: string): Promise<ArcDoc | null> {
  if (!isSafeArcId(id)) return null;
  try {
    const raw = await readFile(path.join(arcsDir(), `${id}.json`), "utf8");
    return JSON.parse(raw) as ArcDoc;
  } catch {
    return null;
  }
}

/** Temp file then rename, so a crash mid-write cannot truncate an arc. */
export async function writeArc(doc: ArcDoc): Promise<void> {
  if (!isSafeArcId(doc.id)) throw new Error(`unsafe arc id: ${doc.id}`);
  const dir = arcsDir();
  await mkdir(dir, { recursive: true });
  const target = path.join(dir, `${doc.id}.json`);
  const temp = path.join(dir, `.${doc.id}.${process.pid}.tmp`);
  await writeFile(temp, `${JSON.stringify(doc, null, 2)}\n`, "utf8");
  await rename(temp, target);
}

export async function listSummaries(): Promise<ArcSummary[]> {
  const ids = await listArcIds();
  const docs = await Promise.all(ids.map((id) => readArc(id)));
  return docs
    .filter((d): d is ArcDoc => d !== null)
    .map((d) => ({
      id: d.id,
      reference: d.passage.reference,
      status: d.status,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
      mainPoint: d.summary.mainPoint,
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
