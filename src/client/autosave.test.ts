// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { newArcDoc } from "@/core/doc";
import type { ArcDoc } from "@/core/types";
import type { SaveResult } from "./api";
import { createAutosave, localStorageMirror, mirrorKey, OFFLINE_BACKOFF_MS } from "./autosave";

function doc(mainPoint = ""): ArcDoc {
  const base = newArcDoc({
    id: "a-1", reference: "Romans 12:1-2", canonical: "Romans 12:1-2", source: "paste",
    text: "one two", verses: [], now: new Date("2026-09-05T15:00:00Z"),
  });
  return { ...base, summary: { ...base.summary, mainPoint } };
}

function harness(results: SaveResult[]) {
  const save = vi.fn<(doc: ArcDoc, force: boolean) => Promise<SaveResult>>(
    async (d) => results.shift() ?? { kind: "saved", doc: d },
  );
  const onState = vi.fn();
  const onSaved = vi.fn();
  const onConflict = vi.fn();
  const onUnauthorized = vi.fn();
  const auto = createAutosave({
    save,
    onState,
    onSaved,
    onConflict,
    onUnauthorized,
    mirror: localStorageMirror(window.localStorage),
    target: document,
    isHidden: () => document.visibilityState === "hidden",
  });
  return { auto, save, onState, onSaved, onConflict, onUnauthorized };
}

beforeEach(() => {
  vi.useFakeTimers();
  window.localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

test("three changes inside a second produce one save, one second after the last", async () => {
  const h = harness([]);
  h.auto.changed(doc("a"));
  await vi.advanceTimersByTimeAsync(400);
  h.auto.changed(doc("b"));
  await vi.advanceTimersByTimeAsync(400);
  h.auto.changed(doc("c"));
  expect(h.save).not.toHaveBeenCalled();

  await vi.advanceTimersByTimeAsync(1000);
  expect(h.save).toHaveBeenCalledTimes(1);
  expect(h.save.mock.calls[0][0].summary.mainPoint).toBe("c");
  expect(h.onState).toHaveBeenLastCalledWith("saved");
});

test("saves are throttled to one every five seconds while editing", async () => {
  const h = harness([]);
  h.auto.changed(doc("a"));
  await vi.advanceTimersByTimeAsync(1000);
  expect(h.save).toHaveBeenCalledTimes(1);

  h.auto.changed(doc("b"));
  await vi.advanceTimersByTimeAsync(1000);
  expect(h.save).toHaveBeenCalledTimes(1);

  await vi.advanceTimersByTimeAsync(4000);
  expect(h.save).toHaveBeenCalledTimes(2);
});

test("a tab going hidden flushes the pending save immediately", async () => {
  const h = harness([]);
  h.auto.changed(doc("a"));
  Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
  document.dispatchEvent(new Event("visibilitychange"));
  await vi.advanceTimersByTimeAsync(0);
  expect(h.save).toHaveBeenCalledTimes(1);
});

test("the unsaved document is mirrored under its id and base rev, then cleared", async () => {
  const h = harness([]);
  const pending = doc("a");
  h.auto.changed(pending);
  const key = mirrorKey(pending.id, pending.rev);
  expect(JSON.parse(window.localStorage.getItem(key) as string).summary.mainPoint).toBe("a");

  await vi.advanceTimersByTimeAsync(1000);
  expect(window.localStorage.getItem(key)).toBeNull();
});

test("the mirror reads back only for the id and rev it was written at", () => {
  const mirror = localStorageMirror(window.localStorage);
  const pending = doc("a");
  mirror.write(pending);
  expect(mirror.read(pending.id, pending.rev)?.summary.mainPoint).toBe("a");
  expect(mirror.read(pending.id, pending.rev + 1)).toBeNull();
  mirror.clear(pending.id);
  expect(mirror.read(pending.id, pending.rev)).toBeNull();
});

test("a conflict pauses autosave until it is retried", async () => {
  const server = { ...doc("server"), rev: 9 };
  const h = harness([{ kind: "conflict", serverDoc: server }]);
  h.auto.changed(doc("a"));
  await vi.advanceTimersByTimeAsync(1000);
  expect(h.onConflict).toHaveBeenCalledWith(server);
  expect(h.onState).toHaveBeenLastCalledWith("conflict");

  h.auto.changed(doc("b"));
  await vi.advanceTimersByTimeAsync(10_000);
  expect(h.save).toHaveBeenCalledTimes(1);

  h.auto.retry(doc("b"), { force: true });
  await vi.advanceTimersByTimeAsync(6000);
  expect(h.save).toHaveBeenCalledTimes(2);
  expect(h.save.mock.calls[1][1]).toBe(true);
});

test("a 401 pauses and the pending save goes out again after the retry", async () => {
  const h = harness([{ kind: "unauthorized" }]);
  h.auto.changed(doc("a"));
  await vi.advanceTimersByTimeAsync(1000);
  expect(h.onUnauthorized).toHaveBeenCalledTimes(1);

  h.auto.retry(doc("a"));
  await vi.advanceTimersByTimeAsync(6000);
  expect(h.save).toHaveBeenCalledTimes(2);
  expect(h.onState).toHaveBeenLastCalledWith("saved");
});

test("offline retries at two, four, eight and sixteen seconds", async () => {
  const h = harness([
    { kind: "offline" }, { kind: "offline" }, { kind: "offline" }, { kind: "offline" },
  ]);
  h.auto.changed(doc("a"));
  await vi.advanceTimersByTimeAsync(1000);
  expect(h.save).toHaveBeenCalledTimes(1);
  expect(h.onState).toHaveBeenLastCalledWith("offline");

  let expected = 1;
  for (const wait of OFFLINE_BACKOFF_MS) {
    await vi.advanceTimersByTimeAsync(wait - 1);
    expect(h.save).toHaveBeenCalledTimes(expected);
    await vi.advanceTimersByTimeAsync(1);
    expected += 1;
    expect(h.save).toHaveBeenCalledTimes(expected);
  }
  expect(h.onState).toHaveBeenLastCalledWith("saved");
});

test("stop removes the visibility listener", async () => {
  const h = harness([]);
  h.auto.changed(doc("a"));
  h.auto.stop();
  document.dispatchEvent(new Event("visibilitychange"));
  await vi.advanceTimersByTimeAsync(5000);
  expect(h.save).not.toHaveBeenCalled();
});
