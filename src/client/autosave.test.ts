// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { newArcDoc } from "@/core/doc";
import type { ArcDoc } from "@/core/types";
import type { SaveResult } from "./api";
import { createAutosave, localStorageMirror, mirrorKey, OFFLINE_BACKOFF_MS, THROTTLE_MS } from "./autosave";

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
  const onError = vi.fn();
  const auto = createAutosave({
    save,
    // Identity: this suite drives the engine directly and never advances a
    // rev, so there is nothing to re-stamp. The engine applying it to every
    // pending document is covered where it matters, in
    // src/components/ArcWorkspace.test.tsx, against a fake server that does
    // increment rev.
    atServerRev: (d) => d,
    onState,
    onSaved,
    onConflict,
    onUnauthorized,
    onError,
    mirror: localStorageMirror(window.localStorage),
    target: document,
    isHidden: () => document.visibilityState === "hidden",
  });
  return { auto, save, onState, onSaved, onConflict, onUnauthorized, onError };
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

test("a flush during an in-flight save issues no second PUT", async () => {
  let resolveSave: (result: SaveResult) => void = () => {};
  const save = vi.fn<(doc: ArcDoc, force: boolean) => Promise<SaveResult>>(
    () => new Promise((resolve) => { resolveSave = resolve; }),
  );
  const onState = vi.fn();
  const auto = createAutosave({
    save,
    // Identity: this suite drives the engine directly and never advances a
    // rev, so there is nothing to re-stamp. The engine applying it to every
    // pending document is covered where it matters, in
    // src/components/ArcWorkspace.test.tsx, against a fake server that does
    // increment rev.
    atServerRev: (d) => d,
    onState,
    onSaved: vi.fn(),
    onConflict: vi.fn(),
    onUnauthorized: vi.fn(),
    onError: vi.fn(),
    mirror: localStorageMirror(window.localStorage),
    target: document,
    isHidden: () => document.visibilityState === "hidden",
  });

  auto.changed(doc("a"));
  await vi.advanceTimersByTimeAsync(1000);
  expect(save).toHaveBeenCalledTimes(1);

  // The save is still on the wire. A tab going hidden now must not fire a
  // second PUT of the same base rev alongside it.
  Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
  document.dispatchEvent(new Event("visibilitychange"));
  await vi.advanceTimersByTimeAsync(0);
  expect(save).toHaveBeenCalledTimes(1);

  resolveSave({ kind: "saved", doc: doc("a") });
  await vi.advanceTimersByTimeAsync(0);
  expect(save).toHaveBeenCalledTimes(1);
  expect(onState).toHaveBeenLastCalledWith("saved");
});

test("continuous typing still produces saves, spaced at least five seconds apart", async () => {
  const saveTimes: number[] = [];
  const save = vi.fn<(doc: ArcDoc, force: boolean) => Promise<SaveResult>>((d) => {
    saveTimes.push(Date.now());
    // A save that takes real time to settle, so a keystroke can land while
    // one is still in flight: the exact condition that let firstChangeAt go
    // stale and, before the fix, collapse the throttle to zero.
    return new Promise((resolve) => setTimeout(() => resolve({ kind: "saved", doc: d }), 250));
  });
  const auto = createAutosave({
    save,
    // Identity: this suite drives the engine directly and never advances a
    // rev, so there is nothing to re-stamp. The engine applying it to every
    // pending document is covered where it matters, in
    // src/components/ArcWorkspace.test.tsx, against a fake server that does
    // increment rev.
    atServerRev: (d) => d,
    onState: vi.fn(),
    onSaved: vi.fn(),
    onConflict: vi.fn(),
    onUnauthorized: vi.fn(),
    onError: vi.fn(),
    mirror: localStorageMirror(window.localStorage),
    target: document,
    isHidden: () => document.visibilityState === "hidden",
  });

  for (let elapsed = 0; elapsed < 12_000; elapsed += 400) {
    auto.changed(doc(`t${elapsed}`));
    await vi.advanceTimersByTimeAsync(400);
  }
  await vi.advanceTimersByTimeAsync(THROTTLE_MS);

  expect(saveTimes.length).toBeGreaterThanOrEqual(2);
  for (let i = 1; i < saveTimes.length; i += 1) {
    expect(saveTimes[i] - saveTimes[i - 1]).toBeGreaterThanOrEqual(THROTTLE_MS);
  }
});

test("a save that throws synchronously does not wedge autosave forever", async () => {
  let calls = 0;
  const onError = vi.fn();
  const save = vi.fn<(doc: ArcDoc, force: boolean) => Promise<SaveResult>>((d) => {
    calls += 1;
    if (calls === 1) throw new Error("boom, synchronous");
    return Promise.resolve({ kind: "saved", doc: d });
  });
  const auto = createAutosave({
    save,
    // Identity: this suite drives the engine directly and never advances a
    // rev, so there is nothing to re-stamp. The engine applying it to every
    // pending document is covered where it matters, in
    // src/components/ArcWorkspace.test.tsx, against a fake server that does
    // increment rev.
    atServerRev: (d) => d,
    onState: vi.fn(),
    onSaved: vi.fn(),
    onConflict: vi.fn(),
    onUnauthorized: vi.fn(),
    onError,
    mirror: localStorageMirror(window.localStorage),
    target: document,
    isHidden: () => document.visibilityState === "hidden",
  });

  auto.changed(doc("a"));
  await vi.advanceTimersByTimeAsync(1000);
  expect(onError).toHaveBeenCalledTimes(1);

  // If the synchronous throw left inFlightPromise permanently non-null,
  // this retry would never fire a second call.
  auto.retry(doc("b"));
  await vi.advanceTimersByTimeAsync(6000);
  expect(calls).toBe(2);
});

test("a newer edit that arrived during a save is re-mirrored, not left only in memory", async () => {
  let resolveSave: (result: SaveResult) => void = () => {};
  const save = vi.fn<(doc: ArcDoc, force: boolean) => Promise<SaveResult>>(
    () => new Promise((resolve) => { resolveSave = resolve; }),
  );
  const auto = createAutosave({
    save,
    // Identity: this suite drives the engine directly and never advances a
    // rev, so there is nothing to re-stamp. The engine applying it to every
    // pending document is covered where it matters, in
    // src/components/ArcWorkspace.test.tsx, against a fake server that does
    // increment rev.
    atServerRev: (d) => d,
    onState: vi.fn(),
    onSaved: vi.fn(),
    onConflict: vi.fn(),
    onUnauthorized: vi.fn(),
    onError: vi.fn(),
    mirror: localStorageMirror(window.localStorage),
    target: document,
    isHidden: () => document.visibilityState === "hidden",
  });

  const first = doc("a");
  auto.changed(first);
  await vi.advanceTimersByTimeAsync(1000);
  expect(save).toHaveBeenCalledTimes(1);

  const second = doc("b");
  auto.changed(second);
  const key = mirrorKey(second.id, second.rev);
  expect(window.localStorage.getItem(key)).not.toBeNull();

  resolveSave({ kind: "saved", doc: first });
  await vi.advanceTimersByTimeAsync(0);

  // The completed save's mirror.clear(id) wipes every key for that id,
  // including the newer edit's; it must be rewritten right after.
  expect(JSON.parse(window.localStorage.getItem(key) as string).summary.mainPoint).toBe("b");
});

test("stop suppresses a save that resolves after unmount", async () => {
  let resolveSave: (result: SaveResult) => void = () => {};
  const save = vi.fn<(doc: ArcDoc, force: boolean) => Promise<SaveResult>>(
    () => new Promise((resolve) => { resolveSave = resolve; }),
  );
  const onState = vi.fn();
  const onSaved = vi.fn();
  const auto = createAutosave({
    save,
    // Identity: this suite drives the engine directly and never advances a
    // rev, so there is nothing to re-stamp. The engine applying it to every
    // pending document is covered where it matters, in
    // src/components/ArcWorkspace.test.tsx, against a fake server that does
    // increment rev.
    atServerRev: (d) => d,
    onState,
    onSaved,
    onConflict: vi.fn(),
    onUnauthorized: vi.fn(),
    onError: vi.fn(),
    mirror: localStorageMirror(window.localStorage),
    target: document,
    isHidden: () => document.visibilityState === "hidden",
  });

  auto.changed(doc("a"));
  await vi.advanceTimersByTimeAsync(1000);
  expect(save).toHaveBeenCalledTimes(1);
  const callsBefore = onState.mock.calls.length;

  auto.stop();
  resolveSave({ kind: "saved", doc: doc("a") });
  await vi.advanceTimersByTimeAsync(0);

  expect(onState.mock.calls.length).toBe(callsBefore);
  expect(onSaved).not.toHaveBeenCalled();
});
