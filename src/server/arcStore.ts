import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ArcDoc, ArcSummary } from "@/core/types";

export type { ArcSummary };

/** Read at call time, not at module load, so tests can point it at a tmpdir. */
export function arcsDir(): string {
  return path.join(process.env.DATA_DIR ?? "./data", "arcs");
}

/** Arc ids are generated from a date and a slug; nothing else is legal. Length-bounded so an oversized id fails cleanly here rather than at the filesystem. */
export function isSafeArcId(id: string): boolean {
  return /^[a-z0-9][a-z0-9-]{0,79}$/.test(id);
}

function isMissingFileError(err: unknown): boolean {
  return err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT";
}

/**
 * The doc fields listSummaries actually dereferences. A file that parses as
 * JSON but is not doc-shaped (e.g. "{}") must not throw partway through the
 * series list; it is treated the same as a corrupt file.
 */
function looksLikeArcDoc(value: unknown): value is ArcDoc {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  if (typeof v.id !== "string" || typeof v.createdAt !== "string") return false;
  if (typeof v.updatedAt !== "string" || typeof v.status !== "string") return false;
  const passage = v.passage as Record<string, unknown> | undefined;
  if (typeof passage?.reference !== "string") return false;
  const summary = v.summary as Record<string, unknown> | undefined;
  if (typeof summary?.mainPoint !== "string") return false;
  return true;
}

export async function listArcIds(): Promise<string[]> {
  try {
    const files = await readdir(arcsDir());
    return files.filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -".json".length));
  } catch (err) {
    if (isMissingFileError(err)) return [];
    throw err;
  }
}

/**
 * Null means "no such arc" (an id never written, or removed out of band; the
 * app has no delete route, so that should never happen). Anything else wrong
 * with the file (corrupt JSON, the wrong shape, a permissions error) throws,
 * so a caller sees a real failure instead of a silently vanished arc.
 */
export async function readArc(id: string): Promise<ArcDoc | null> {
  if (!isSafeArcId(id)) return null;
  let raw: string;
  try {
    raw = await readFile(path.join(arcsDir(), `${id}.json`), "utf8");
  } catch (err) {
    if (isMissingFileError(err)) return null;
    throw err;
  }
  const parsed: unknown = JSON.parse(raw);
  if (!looksLikeArcDoc(parsed)) throw new Error(`corrupt arc file: ${id}`);
  return parsed;
}

/** Temp file then rename, so a crash mid-write cannot truncate an arc. */
export async function writeArc(doc: ArcDoc): Promise<void> {
  if (!isSafeArcId(doc.id)) throw new Error(`unsafe arc id: ${doc.id}`);
  const dir = arcsDir();
  await mkdir(dir, { recursive: true });
  const target = path.join(dir, `${doc.id}.json`);
  // randomUUID, not just id + pid: two overlapping writes of the same arc
  // (autosave's debounce plus its visibilitychange flush) must not share one
  // temp file.
  const temp = path.join(dir, `.${doc.id}.${process.pid}.${randomUUID()}.tmp`);
  try {
    await writeFile(temp, `${JSON.stringify(doc, null, 2)}\n`, "utf8");
    await rename(temp, target);
  } catch (err) {
    await unlink(temp).catch(() => {});
    throw err;
  }
}

export async function listSummaries(): Promise<ArcSummary[]> {
  const ids = await listArcIds();
  const docs = await Promise.all(
    ids.map(async (id) => {
      try {
        return await readArc(id);
      } catch {
        // A corrupt or wrong-shaped file is skipped in a list; readArc
        // called directly for that id still throws.
        return null;
      }
    }),
  );
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
