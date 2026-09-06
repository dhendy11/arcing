"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { getArc, putArc } from "@/client/api";
import { createAutosave, localStorageMirror, type Autosave, type MirrorPort } from "@/client/autosave";
import { canRedo, canUndo, redo, undo, useArcStore } from "@/client/store";
import { isRooted } from "@/core/tree";
import type { ArcDoc } from "@/core/types";
import { ArcFrame, type ArcTab } from "./ArcFrame";
import { SplitView } from "./SplitView";

export function ArcWorkspace({ id, tab }: { id: string; tab: ArcTab }) {
  const router = useRouter();
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
      onSaved: (saved) => useArcStore.setState({ doc: saved }),
      onConflict: (serverDoc) => useArcStore.getState().setConflictDoc(serverDoc),
      onUnauthorized: () => setNeedsLogin(true),
      onError: (message) => setErrorMessage(message),
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

  if (!doc) return <main className="page">Loading</main>;

  return (
    <main>
      {errorMessage ? (
        <p role="alert" className="workspace-error">
          {errorMessage}
        </p>
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
          if (current) autosaveRef.current?.changed(current);
        }}
        onRedo={() => {
          redo();
          const current = useArcStore.getState().doc;
          if (current) autosaveRef.current?.changed(current);
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
        {tab === "split" ? <SplitView doc={doc} onChange={edit} /> : null}
      </ArcFrame>
    </main>
  );
}
