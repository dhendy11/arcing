"use client";

import { useRouter, usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { getArc, putArc } from "@/client/api";
import { createAutosave, localStorageMirror, type Autosave, type MirrorPort } from "@/client/autosave";
import { canRedo, canUndo, redo, undo, useArcStore } from "@/client/store";
import { isRooted } from "@/core/tree";
import type { ArcDoc } from "@/core/types";
import { ArcFrame, type ArcTab } from "./ArcFrame";

/**
 * The edit function the current tab's screen calls to change the document.
 * Split, Relate and Summarize are separate route leaves under this
 * workspace's layout, so they cannot receive it as a plain prop the way a
 * directly-rendered child would; a context is the wiring for "hand each
 * screen a pure doc plus onChange" once the screen is a sibling route
 * rather than a child element.
 */
const EditContext = createContext<((doc: ArcDoc) => void) | null>(null);

export function useArcEdit(): (doc: ArcDoc) => void {
  const edit = useContext(EditContext);
  if (!edit) throw new Error("useArcEdit must be called inside ArcWorkspace");
  return edit;
}

function tabFromPathname(pathname: string): ArcTab {
  if (pathname.endsWith("/relate")) return "relate";
  if (pathname.endsWith("/summarize")) return "summarize";
  return "split";
}

/**
 * The shared shell for Split, Relate and Summarize. This is a layout, not a
 * per-tab page: the three screens are route leaves nested under it
 * (src/app/a/[id]/{split,relate,summarize}/page.tsx), so switching tabs
 * only swaps `children` and never remounts this component. Mounting once
 * per arc (not once per tab) is load-bearing: undo history, the autosave
 * debounce and the mirror-restore banner all live in effect/ref state here,
 * and a remount on every tab click used to clear undo history and drop
 * whatever edit was still inside the debounce window.
 */
export function ArcWorkspace({ id, children }: { id: string; children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const tab = tabFromPathname(pathname);
  const doc = useArcStore((s) => s.doc);
  const saveState = useArcStore((s) => s.saveState);
  const conflictDoc = useArcStore((s) => s.conflictDoc);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [mirrored, setMirrored] = useState<ArcDoc | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const autosaveRef = useRef<Autosave | null>(null);
  const mirrorRef = useRef<MirrorPort | null>(null);

  useEffect(() => {
    // Created here, not at render time: this component renders once on the
    // server as part of the page's initial HTML, where window does not
    // exist. An effect only ever runs in the browser.
    const mirror = localStorageMirror(window.localStorage);
    mirrorRef.current = mirror;

    const store = useArcStore.getState();
    const autosave = createAutosave({
      save: (d, force) => putArc(d, force),
      onState: (state) => {
        useArcStore.getState().setSaveState(state);
        if (state === "saving") setErrorMessage(null);
      },
      onSaved: (saved) => {
        // A plain setState here is a real undo step to zundo (reference
        // inequality against the pre-save doc), even though nothing the
        // user did changed: the saved copy differs only in rev and
        // updatedAt. Left unpaused, every successful save pushes a
        // duplicate step, so the first Undo after a save is a no-op that
        // then resends a stale rev and raises a conflict. latestServerRev
        // is updated in the same write: it is what onUndo/onRedo re-stamp
        // a restored snapshot with, since the snapshot's own embedded rev
        // is whatever it was when that history step was captured, not
        // what the server holds now.
        const temporal = useArcStore.temporal.getState();
        temporal.pause();
        useArcStore.setState({ doc: saved, latestServerRev: saved.rev });
        temporal.resume();
      },
      onConflict: (serverDoc) => useArcStore.getState().setConflictDoc(serverDoc),
      onUnauthorized: () => setNeedsLogin(true),
      onError: (message) => {
        // message is an arbitrary exception string (a network failure, an
        // unreadable response body); it is not copy anyone has written for
        // Drew to read. Log the detail, show one fixed sentence.
        console.error("autosave failed:", message);
        setErrorMessage("Could not save automatically. Your changes are kept on this device.");
      },
      mirror,
      target: document,
      isHidden: () => document.visibilityState === "hidden",
    });
    autosaveRef.current = autosave;

    void (async () => {
      const loaded = await getArc(id);
      if (!loaded) {
        router.push("/");
        return;
      }
      store.loadArc(loaded);
      setMirrored(mirror.read(loaded.id, loaded.rev));
    })();

    return () => {
      autosave.stop();
      useArcStore.getState().leaveArc();
    };
  }, [id, router]);

  function edit(next: ArcDoc): void {
    useArcStore.getState().editDoc(next);
    autosaveRef.current?.changed(next);
  }

  /**
   * What undo/redo hand to autosave. `restored.rev` is whatever it was when
   * that history step was captured, which the server may since have moved
   * past (see latestServerRev's doc comment in store.ts); only `rev` is
   * re-stamped, so the restored content itself is sent exactly as undo or
   * redo produced it.
   */
  function forSave(restored: ArcDoc): ArcDoc {
    const latestServerRev = useArcStore.getState().latestServerRev;
    return latestServerRev === null ? restored : { ...restored, rev: latestServerRev };
  }

  if (!doc) return <main className="page">Loading</main>;

  return (
    <main>
      {errorMessage ? (
        <div role="alert" className="banner">
          <span>{errorMessage}</span>
          <button
            type="button"
            onClick={() => {
              const current = useArcStore.getState().doc;
              if (current) autosaveRef.current?.retry(current);
            }}
          >
            Try again
          </button>
        </div>
      ) : null}
      <ArcFrame
        reference={doc.passage.reference}
        tab={tab}
        onTab={(next) => router.push(`/a/${id}/${next}`)}
        onSeries={() => router.push("/")}
        saveState={saveState}
        canSummarize={isRooted(doc)}
        canUndo={canUndo()}
        canRedo={canRedo()}
        onUndo={() => {
          undo();
          const current = useArcStore.getState().doc;
          if (current) autosaveRef.current?.changed(forSave(current));
        }}
        onRedo={() => {
          redo();
          const current = useArcStore.getState().doc;
          if (current) autosaveRef.current?.changed(forSave(current));
        }}
        showNotice={tab !== "summarize"}
        conflictDoc={conflictDoc}
        onReload={() => {
          const server = conflictDoc;
          if (!server) return;
          autosaveRef.current?.reset();
          useArcStore.getState().loadArc(server);
        }}
        onOverwrite={() => {
          const current = useArcStore.getState().doc;
          useArcStore.getState().setConflictDoc(null);
          if (current) autosaveRef.current?.retry(current, { force: true });
        }}
        needsLogin={needsLogin}
        onSignedIn={() => {
          setNeedsLogin(false);
          const current = useArcStore.getState().doc;
          if (current) autosaveRef.current?.retry(current);
        }}
        mirrored={mirrored}
        onRestore={() => {
          if (mirrored) edit(mirrored);
          setMirrored(null);
        }}
        onDiscard={() => {
          mirrorRef.current?.clear(id);
          setMirrored(null);
        }}
      >
        <EditContext.Provider value={edit}>{children}</EditContext.Provider>
      </ArcFrame>
    </main>
  );
}
