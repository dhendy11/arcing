import { temporal } from "zundo";
import { create } from "zustand";
import type { ArcDoc, Member } from "@/core/types";

export type SaveState = "saved" | "saving" | "unsaved" | "offline" | "conflict";

/** Every edit on all three screens is undoable, 200 steps deep. */
export const UNDO_LIMIT = 200;

interface ArcState {
  doc: ArcDoc | null;
  saveState: SaveState;
  selection: Member[];
  /** The server copy delivered by a 409, shown behind the conflict banner. */
  conflictDoc: ArcDoc | null;
  /**
   * The rev the server last actually confirmed, tracked separately from
   * `doc.rev`. `rev` is a server concurrency token, not user content: undo
   * and redo restore a past CONTENT snapshot whose own embedded `rev` field
   * is whatever it was at the time that snapshot was captured, which can be
   * stale the moment a save completes in between. Re-stamping a
   * to-be-saved doc with this field, rather than trusting the restored
   * snapshot's own `rev`, is what keeps an ordinary undo from resending a
   * stale rev and tripping a conflict against this client's own save.
   */
  latestServerRev: number | null;
  loadArc: (doc: ArcDoc) => void;
  editDoc: (doc: ArcDoc) => void;
  leaveArc: () => void;
  setSaveState: (state: SaveState) => void;
  setSelection: (selection: Member[]) => void;
  setConflictDoc: (doc: ArcDoc | null) => void;
}

export const useArcStore = create<ArcState>()(
  temporal(
    (set) => ({
      doc: null,
      saveState: "saved",
      selection: [],
      conflictDoc: null,
      latestServerRev: null,
      loadArc: (doc) => {
        set({ doc, selection: [], conflictDoc: null, saveState: "saved", latestServerRev: doc.rev });
        clearHistory();
      },
      editDoc: (doc) => set({ doc }),
      leaveArc: () => {
        set({ doc: null, selection: [], conflictDoc: null, saveState: "saved", latestServerRev: null });
        clearHistory();
      },
      setSaveState: (saveState) => set({ saveState }),
      setSelection: (selection) => set({ selection }),
      setConflictDoc: (conflictDoc) => set({ conflictDoc }),
    }),
    {
      limit: UNDO_LIMIT,
      // Only the document is history. Save state, selection and the conflict
      // copy are view state; undoing them would be nonsense.
      partialize: (state) => ({ doc: state.doc }),
      // Without this, zundo records a history step on every set() call, even
      // one that only touches saveState or selection and leaves doc alone.
      // editDoc always replaces doc with a new object, so reference equality
      // is enough to tell a real edit from a view-state change.
      equality: (past, current) => past.doc === current.doc,
    }
  )
);

export function undo(): void {
  useArcStore.temporal.getState().undo();
}

export function redo(): void {
  useArcStore.temporal.getState().redo();
}

export function clearHistory(): void {
  useArcStore.temporal.getState().clear();
}

export function historyDepth(): number {
  return useArcStore.temporal.getState().pastStates.length;
}

export function canUndo(): boolean {
  return historyDepth() > 0;
}

export function canRedo(): boolean {
  return useArcStore.temporal.getState().futureStates.length > 0;
}
