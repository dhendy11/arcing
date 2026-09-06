"use client";

import { useEffect, type ReactNode } from "react";
import type { SaveState } from "@/client/store";
import type { ArcDoc } from "@/core/types";
import { EsvNotice } from "./EsvNotice";
import { LoginForm } from "./LoginForm";
import { SaveChip } from "./SaveChip";

export type ArcTab = "split" | "relate" | "summarize";

const TABS: { id: ArcTab; label: string }[] = [
  { id: "split", label: "Split" },
  { id: "relate", label: "Relate" },
  { id: "summarize", label: "Summarize" },
];

export function ArcFrame({
  reference,
  tab,
  onTab,
  onSeries,
  saveState,
  canSummarize,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  showNotice,
  conflictDoc,
  onReload,
  onOverwrite,
  needsLogin,
  onSignedIn,
  mirrored,
  onRestore,
  onDiscard,
  children,
}: {
  reference: string;
  tab: ArcTab;
  onTab: (tab: ArcTab) => void;
  onSeries: () => void;
  saveState: SaveState;
  /** Summarize opens only once one top level unit covers every proposition. */
  canSummarize: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  showNotice: boolean;
  conflictDoc: ArcDoc | null;
  onReload: () => void;
  onOverwrite: () => void;
  needsLogin: boolean;
  onSignedIn: () => void;
  mirrored: ArcDoc | null;
  onRestore: () => void;
  onDiscard: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key.toLowerCase() !== "z" || !(event.metaKey || event.ctrlKey)) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }
      event.preventDefault();
      if (event.shiftKey) {
        if (canRedo) onRedo();
      } else if (canUndo) {
        onUndo();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onUndo, onRedo, canUndo, canRedo]);

  return (
    <div className="arc-frame">
      <header className="bar">
        <button type="button" onClick={onSeries}>
          Series
        </button>
        <span className="frame-reference">{reference}</span>

        <nav role="tablist" aria-label="Arc steps">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              disabled={t.id === "summarize" && !canSummarize}
              onClick={() => onTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <SaveChip state={saveState} />
        <button type="button" onClick={onUndo} disabled={!canUndo}>
          Undo
        </button>
        <button type="button" onClick={onRedo} disabled={!canRedo}>
          Redo
        </button>
      </header>

      {conflictDoc === null ? null : (
        <div role="alert" className="banner banner-conflict">
          <span>
            This arc changed somewhere else. Reload drops the edits made on this device, and
            Overwrite replaces the copy saved elsewhere.
          </span>
          <button type="button" onClick={onReload}>
            Reload
          </button>
          <button type="button" onClick={onOverwrite}>
            Overwrite
          </button>
        </div>
      )}

      {mirrored === null ? null : (
        <div role="alert" className="banner banner-mirror">
          <span>There are unsaved changes on this device.</span>
          <button type="button" onClick={onRestore}>
            Restore
          </button>
          <button type="button" onClick={onDiscard}>
            Discard
          </button>
        </div>
      )}

      <div className="screen">{children}</div>

      {showNotice ? <EsvNotice /> : null}

      {needsLogin ? (
        <div className="modal" role="dialog" aria-label="Sign in again">
          <p>Your session expired. Sign in and the save will go out again.</p>
          <LoginForm onSignedIn={onSignedIn} />
        </div>
      ) : null}
    </div>
  );
}
