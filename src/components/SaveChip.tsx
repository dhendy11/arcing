import type { SaveState } from "@/client/store";

const LABELS: Record<SaveState, string> = {
  saved: "Saved",
  saving: "Saving",
  unsaved: "Unsaved",
  offline: "Offline",
  conflict: "Conflict",
};

export function SaveChip({ state }: { state: SaveState }) {
  return (
    <span className={`chip chip-${state}`} data-testid="save-chip" data-state={state}>
      {LABELS[state]}
    </span>
  );
}
