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
  useArcStore.setState({ doc: null, saveState: "saved", selection: [], conflictDoc: null });
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

test("leaving the arc clears the document and the history", () => {
  useArcStore.getState().loadArc(fresh());
  useArcStore.getState().editDoc(splitAt(fresh(), 4));
  useArcStore.getState().leaveArc();
  expect(useArcStore.getState().doc).toBeNull();
  expect(historyDepth()).toBe(0);
  expect(canUndo()).toBe(false);
});
