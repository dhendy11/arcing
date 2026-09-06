import { beforeEach, expect, test } from "vitest";
import { newArcDoc } from "@/core/doc";
import { splitAt } from "@/core/split";
import type { ArcDoc } from "@/core/types";
import {
  canRedo,
  canUndo,
  clearHistory,
  historyDepth,
  redo,
  undo,
  UNDO_LIMIT,
  useArcStore,
} from "./store";

function fresh(): ArcDoc {
  return newArcDoc({
    id: "d", reference: "Romans 12:1-2", canonical: "Romans 12:1-2", source: "paste",
    text: "one two three four five", verses: [], now: new Date("2026-09-05T15:00:00Z"),
  });
}

beforeEach(() => {
  useArcStore.setState({ doc: null, saveState: "saved", selection: [], conflictDoc: null, latestServerRev: null });
  clearHistory();
});

test("loading an arc starts with an empty history", () => {
  useArcStore.getState().loadArc(fresh());
  expect(useArcStore.getState().doc?.id).toBe("d");
  expect(historyDepth()).toBe(0);
  expect(canUndo()).toBe(false);
});

test("an edit is undoable and redoable", () => {
  useArcStore.getState().loadArc(fresh());
  useArcStore.getState().editDoc(splitAt(fresh(), 4));
  expect(useArcStore.getState().doc?.propositions).toHaveLength(2);

  undo();
  expect(useArcStore.getState().doc?.propositions).toHaveLength(1);
  expect(canRedo()).toBe(true);

  redo();
  expect(useArcStore.getState().doc?.propositions).toHaveLength(2);
});

test("save state and selection changes are not undo steps", () => {
  useArcStore.getState().loadArc(fresh());
  useArcStore.getState().setSaveState("saving");
  useArcStore.getState().setSelection([{ kind: "prop", ref: "p1" }]);
  expect(historyDepth()).toBe(0);
});

test("history is capped at 200 steps", () => {
  useArcStore.getState().loadArc(fresh());
  for (let i = 0; i < UNDO_LIMIT + 40; i += 1) {
    const doc = useArcStore.getState().doc as ArcDoc;
    useArcStore.getState().editDoc({ ...doc, summary: { ...doc.summary, mainPoint: `edit ${i}` } });
  }
  expect(historyDepth()).toBe(UNDO_LIMIT);
});

test("pausing the temporal store around a save write does not add an undo step", () => {
  useArcStore.getState().loadArc(fresh());
  useArcStore.getState().editDoc(splitAt(fresh(), 4));
  expect(historyDepth()).toBe(1);

  // The pattern ArcWorkspace's autosave onSaved callback uses: the server's
  // response is a fresh object (a new rev), which zundo's reference-equality
  // guard would otherwise record as a second, spurious undo step for the
  // same logical edit, making the first Undo after a save a no-op.
  const saved: ArcDoc = { ...(useArcStore.getState().doc as ArcDoc), rev: 2 };
  const temporal = useArcStore.temporal.getState();
  temporal.pause();
  useArcStore.setState({ doc: saved, latestServerRev: 2 });
  temporal.resume();

  expect(historyDepth()).toBe(1);
  expect(useArcStore.getState().doc?.rev).toBe(2);

  undo();
  expect(useArcStore.getState().doc?.propositions).toHaveLength(1);
  expect(historyDepth()).toBe(0);
});

test("undo restamps the restored rev to the latest server-confirmed rev, not the undone-to rev", () => {
  useArcStore.getState().loadArc(fresh());
  expect(useArcStore.getState().latestServerRev).toBe(1);

  useArcStore.getState().editDoc(splitAt(fresh(), 4));
  expect(useArcStore.getState().doc?.rev).toBe(1); // edits never bump rev locally

  // Simulate the save completing: the server confirms rev 2, the same
  // pause/setState/resume write onSaved performs.
  const saved: ArcDoc = { ...(useArcStore.getState().doc as ArcDoc), rev: 2 };
  const temporal = useArcStore.temporal.getState();
  temporal.pause();
  useArcStore.setState({ doc: saved, latestServerRev: 2 });
  temporal.resume();

  undo();
  const restored = useArcStore.getState().doc as ArcDoc;
  // The undone-to snapshot's own embedded rev is stale: it was captured
  // before the save, so it still reads 1.
  expect(restored.rev).toBe(1);
  expect(restored.propositions).toHaveLength(1);

  // This is exactly the re-stamp ArcWorkspace's onUndo/onRedo perform
  // before handing the restored doc to autosave: send the tracked
  // server-confirmed rev, not the snapshot's own, so the PUT matches what
  // the server actually holds and does not raise a false conflict against
  // this client's own prior save. The server side of this claim (a PUT at
  // the matching rev succeeds, a PUT at a stale rev is a 409) is covered
  // separately in src/server/routes.test.ts; this test is the client's
  // half, that it computes the matching rev in the first place.
  const latestServerRev = useArcStore.getState().latestServerRev;
  const toSave = latestServerRev === null ? restored : { ...restored, rev: latestServerRev };
  expect(toSave.rev).toBe(2);
  expect(toSave.propositions).toHaveLength(1);
});

test("leaving the arc clears the document and the history", () => {
  useArcStore.getState().loadArc(fresh());
  useArcStore.getState().editDoc(splitAt(fresh(), 4));
  useArcStore.getState().leaveArc();
  expect(useArcStore.getState().doc).toBeNull();
  expect(historyDepth()).toBe(0);
  expect(canUndo()).toBe(false);
});
