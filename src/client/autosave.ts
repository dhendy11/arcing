import type { ArcDoc } from "@/core/types";
import type { SaveResult } from "./api";
import type { SaveState } from "./store";

/** PUT one second after the last change. */
export const DEBOUNCE_MS = 1000;
/** At most one PUT every five seconds while editing. */
export const THROTTLE_MS = 5000;
/** iPad Safari suspends tabs, so a hidden tab flushes rather than waits. */
export const OFFLINE_BACKOFF_MS = [2000, 4000, 8000, 16000] as const;

export function mirrorKey(id: string, rev: number): string {
  return `arc:${id}:${rev}`;
}

export interface MirrorPort {
  write(doc: ArcDoc): void;
  read(id: string, rev: number): ArcDoc | null;
  clear(id: string): void;
}

export function localStorageMirror(storage: Storage): MirrorPort {
  return {
    write(doc) {
      try {
        storage.setItem(mirrorKey(doc.id, doc.rev), JSON.stringify(doc));
      } catch {
        // A full or disabled store is not a reason to lose the edit in memory.
      }
    },
    read(id, rev) {
      const raw = storage.getItem(mirrorKey(id, rev));
      if (!raw) return null;
      try {
        return JSON.parse(raw) as ArcDoc;
      } catch {
        return null;
      }
    },
    clear(id) {
      for (let i = storage.length - 1; i >= 0; i -= 1) {
        const key = storage.key(i);
        if (key && key.startsWith(`arc:${id}:`)) storage.removeItem(key);
      }
    },
  };
}

export interface AutosaveDeps {
  save(doc: ArcDoc, force: boolean): Promise<SaveResult>;
  onState(state: SaveState): void;
  onSaved(doc: ArcDoc): void;
  onConflict(serverDoc: ArcDoc): void;
  onUnauthorized(): void;
  mirror: MirrorPort;
  /** Usually document. Omit in a non-DOM context. */
  target?: EventTarget | null;
  isHidden?: () => boolean;
}

export interface Autosave {
  changed(doc: ArcDoc): void;
  flush(): Promise<void>;
  /** Resume after a conflict or a re-login. force sends ?force=1 once. */
  retry(doc: ArcDoc, opts?: { force?: boolean }): void;
  /** Drop the pending edit, for example after choosing Reload on a conflict. */
  reset(): void;
  stop(): void;
}

export function createAutosave(deps: AutosaveDeps): Autosave {
  let pending: ArcDoc | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastSaveAt = Number.NEGATIVE_INFINITY;
  let paused = false;
  let forceNext = false;
  let offlineStep = 0;

  const clearTimer = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };

  const schedule = (delay: number) => {
    clearTimer();
    if (paused || pending === null) return;
    timer = setTimeout(() => {
      timer = null;
      void run();
    }, delay);
  };

  const scheduleNormal = () => {
    const sinceLast = Date.now() - lastSaveAt;
    schedule(Math.max(DEBOUNCE_MS, THROTTLE_MS - sinceLast));
  };

  async function run(): Promise<void> {
    if (paused || pending === null) return;
    const sending = pending;
    const force = forceNext;
    forceNext = false;
    lastSaveAt = Date.now();
    deps.onState("saving");

    const result = await deps.save(sending, force);

    switch (result.kind) {
      case "saved": {
        offlineStep = 0;
        deps.mirror.clear(sending.id);
        deps.onSaved(result.doc);
        if (pending === sending) {
          pending = null;
          deps.onState("saved");
        } else {
          deps.onState("unsaved");
          scheduleNormal();
        }
        return;
      }
      case "conflict": {
        paused = true;
        clearTimer();
        deps.onState("conflict");
        deps.onConflict(result.serverDoc);
        return;
      }
      case "unauthorized": {
        paused = true;
        clearTimer();
        deps.onState("unsaved");
        deps.onUnauthorized();
        return;
      }
      case "offline": {
        const wait = OFFLINE_BACKOFF_MS[Math.min(offlineStep, OFFLINE_BACKOFF_MS.length - 1)];
        offlineStep += 1;
        deps.onState("offline");
        schedule(wait);
        return;
      }
      case "invalid": {
        // A validation failure is a bug in the core, not a user path. Keep the
        // edit pending so the next change retries it, and surface it.
        console.error("save refused as invalid", result.violations);
        deps.onState("unsaved");
        return;
      }
    }
  }

  const onVisibility = () => {
    if (deps.isHidden?.() ?? false) void flush();
  };

  async function flush(): Promise<void> {
    clearTimer();
    await run();
  }

  deps.target?.addEventListener("visibilitychange", onVisibility);

  return {
    changed(doc) {
      pending = doc;
      deps.mirror.write(doc);
      deps.onState("unsaved");
      scheduleNormal();
    },
    flush,
    retry(doc, opts) {
      paused = false;
      forceNext = opts?.force ?? false;
      pending = doc;
      offlineStep = 0;
      scheduleNormal();
    },
    reset() {
      pending = null;
      paused = false;
      forceNext = false;
      offlineStep = 0;
      clearTimer();
    },
    stop() {
      clearTimer();
      pending = null;
      deps.target?.removeEventListener("visibilitychange", onVisibility);
    },
  };
}
