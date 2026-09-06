import { mkdtemp, readdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, test } from "vitest";
import { newArcDoc } from "@/core/doc";
import type { ArcDoc } from "@/core/types";
import { arcsDir, isSafeArcId, listArcIds, listSummaries, readArc, writeArc } from "./arcStore";

const previous = process.env.DATA_DIR;

beforeEach(async () => {
  process.env.DATA_DIR = await mkdtemp(path.join(tmpdir(), "arcing-store-"));
});

afterEach(() => {
  process.env.DATA_DIR = previous;
});

function doc(id: string, reference: string, createdAt: string): ArcDoc {
  const base = newArcDoc({
    id, reference, canonical: reference, source: "paste",
    text: "one two", verses: [], now: new Date(createdAt),
  });
  return base;
}

test("an unwritten arc reads back as null", async () => {
  expect(await readArc("2026-09-05-romans-12-1-2")).toBeNull();
});

test("a written arc reads back identical", async () => {
  const written = doc("2026-09-05-romans-12-1-2", "Romans 12:1-2", "2026-09-05T15:00:00Z");
  await writeArc(written);
  expect(await readArc(written.id)).toEqual(written);
});

test("arcs are stored pretty printed under arcs/", async () => {
  const written = doc("2026-09-05-romans-12-1-2", "Romans 12:1-2", "2026-09-05T15:00:00Z");
  await writeArc(written);
  const files = await readdir(arcsDir());
  expect(files).toEqual(["2026-09-05-romans-12-1-2.json"]);
  const raw = await readFile(path.join(arcsDir(), files[0]), "utf8");
  expect(raw).toContain('\n  "id"');
  expect(raw.endsWith("\n")).toBe(true);
});

test("writing leaves no temporary file behind", async () => {
  await writeArc(doc("a-1", "Romans 12:1", "2026-09-05T15:00:00Z"));
  const files = await readdir(arcsDir());
  expect(files.every((f) => f.endsWith(".json"))).toBe(true);
});

test("a rewrite replaces the file rather than appending", async () => {
  const first = doc("a-1", "Romans 12:1", "2026-09-05T15:00:00Z");
  await writeArc(first);
  await writeArc({ ...first, rev: 2, summary: { ...first.summary, mainPoint: "second" } });
  const stored = await readArc("a-1");
  expect(stored?.rev).toBe(2);
  expect(stored?.summary.mainPoint).toBe("second");
});

test("ids are listed and summaries come back newest first", async () => {
  await writeArc(doc("2026-09-01-a", "Romans 1:1", "2026-09-01T10:00:00Z"));
  const later = doc("2026-09-05-b", "Romans 12:1-2", "2026-09-05T10:00:00Z");
  await writeArc({ ...later, summary: { ...later.summary, mainPoint: "Present your bodies." } });

  expect((await listArcIds()).sort()).toEqual(["2026-09-01-a", "2026-09-05-b"]);
  const summaries = await listSummaries();
  expect(summaries.map((s) => s.id)).toEqual(["2026-09-05-b", "2026-09-01-a"]);
  expect(summaries[0]).toEqual({
    id: "2026-09-05-b",
    reference: "Romans 12:1-2",
    status: "split",
    createdAt: "2026-09-05T10:00:00.000Z",
    updatedAt: "2026-09-05T10:00:00.000Z",
    mainPoint: "Present your bodies.",
  });
});

test("an id that could escape the data directory is refused", async () => {
  expect(isSafeArcId("2026-09-05-romans-12-1-2")).toBe(true);
  expect(isSafeArcId("../../etc/passwd")).toBe(false);
  expect(isSafeArcId("a/b")).toBe(false);
  expect(isSafeArcId("A_B")).toBe(false);
  await expect(readArc("../../etc/passwd")).resolves.toBeNull();
  await expect(writeArc(doc("../evil", "Romans 1:1", "2026-09-05T10:00:00Z"))).rejects.toThrow(/unsafe arc id/);
});

test("a corrupt file is skipped rather than breaking the list", async () => {
  await writeArc(doc("a-1", "Romans 1:1", "2026-09-05T10:00:00Z"));
  const { writeFile } = await import("node:fs/promises");
  await writeFile(path.join(arcsDir(), "broken.json"), "{ not json", "utf8");
  const summaries = await listSummaries();
  expect(summaries.map((s) => s.id)).toEqual(["a-1"]);
});
