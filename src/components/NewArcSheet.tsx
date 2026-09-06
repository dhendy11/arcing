"use client";

import { useState, type FormEvent } from "react";
import { createArc } from "@/client/api";
import type { ArcDoc } from "@/core/types";

type Tab = "fetch" | "paste";

export function NewArcSheet({
  onCreated,
  onClose,
}: {
  onCreated: (doc: ArcDoc) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>("fetch");
  const [reference, setReference] = useState("");
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await createArc(tab === "paste" ? { reference, text } : { reference });
    setBusy(false);

    if (result.kind === "created") {
      onCreated(result.doc);
      return;
    }
    if (result.kind === "esv_unavailable") {
      setTab("paste");
      setError("ESV unavailable, paste the text");
      return;
    }
    setError(result.kind === "unauthorized" ? "Sign in again." : result.message);
  }

  return (
    <div className="sheet" role="dialog" aria-label="New arc">
      <div role="tablist" aria-label="Passage source">
        {(["fetch", "paste"] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
          >
            {value === "fetch" ? "Fetch" : "Paste"}
          </button>
        ))}
      </div>

      <form onSubmit={submit}>
        <label htmlFor="reference">Reference</label>
        <input id="reference" value={reference} onChange={(e) => setReference(e.target.value)} />

        {tab === "paste" ? (
          <>
            <label htmlFor="passage-text">Passage text</label>
            <textarea id="passage-text" value={text} onChange={(e) => setText(e.target.value)} rows={8} />
          </>
        ) : null}

        {error === null ? null : <p role="alert">{error}</p>}

        <div className="sheet-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" disabled={busy}>
            Create
          </button>
        </div>
      </form>
    </div>
  );
}
