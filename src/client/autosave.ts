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
  /** A response the client could not make sense of (see SaveResult's "error"). */
  onError(message: string): void;
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
  /** When the current unsaved run of edits started. Caps scheduleNormal's
   * delay so continuous editing (a change arriving faster than the 1 s
   * debounce) cannot push the save out forever; a PUT still goes out within
   * THROTTLE_MS of the first change in the run. Cleared whenever pending
   * returns to null and reset by retry(), which starts a fresh run. */
  let firstChangeAt: number | null = null;
  /** The in-flight save's own completion, or null when none is outstanding.
   * A timer firing while this is set must not start a second PUT of the
   * same document; flush() awaits it instead of racing it. */
  let inFlightPromise: Promise<void> | null = null;
  let stopped = false;

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
    let delay = Math.max(DEBOUNCE_MS, THROTTLE_MS - sinceLast);
    if (firstChangeAt !== null) {
      delay = Math.min(delay, Math.max(firstChangeAt + THROTTLE_MS - Date.now(), 0));
    }
    // The cap above exists to stop starvation, not to override the real
    // throttle: firstChangeAt can go stale (an edit that landed mid-flight
    // keeps the original window's timestamp until the save completes), and
    // once its window has passed the cap collapses to 0. Never schedule
    // sooner than THROTTLE_MS after the last save actually sent, no matter
    // what the cap computed. Harmless on the very first save, where
    // lastSaveAt is still -Infinity.
    delay = Math.max(delay, lastSaveAt + THROTTLE_MS - Date.now());
    schedule(delay);
  };

  async function run(): Promise<void> {
    // inFlightPromise !== null means a save is already on the wire for the
    // current pending doc. A timer firing here is a duplicate attempt, not a
    // new one: no-op, because the in-flight save's own completion (the
    // "saved" branch below) already reschedules against whatever pending
    // is by the time it resolves.
    if (paused || pending === null || inFlightPromise !== null) return;
    const sending = pending;
    const force = forceNext;
    forceNext = false;
    lastSaveAt = Date.now();
    deps.onState("saving");

    // deps.save is documented to return a Promise, but a mock (or a future
    // implementation) could throw synchronously instead of rejecting.
    // Route that through the Promise machinery here, before attempt below
    // is constructed: that guarantees attempt's first await always defers
    // to a microtask, which in turn guarantees inFlightPromise = attempt
    // (after this block) always runs before attempt's own cleanup can,
    // regardless of how deps.save fails. Without this, a synchronous throw
    // would run attempt's cleanup before inFlightPromise was ever set,
    // leaving it permanently non-null and wedging every future save.
    let savePromise: Promise<SaveResult>;
    try {
      savePromise = deps.save(sending, force);
    } catch (err) {
      savePromise = Promise.reject(err);
    }

    const attempt = (async (): Promise<void> => {
      let result: SaveResult;
      try {
        result = await savePromise;
      } catch (err) {
        // deps.save rejected or threw. There is no SaveResult to branch on,
        // so this is handled the same way as the "error" case below: pause,
        // surface it, and leave pending (and its mirror entry) untouched so
        // a retry() can resend it.
        inFlightPromise = null;
        if (stopped) return;
        paused = true;
        clearTimer();
        deps.onState("unsaved");
        deps.onError(err instanceof Error ? err.message : "the save failed unexpectedly");
        return;
      }
      inFlightPromise = null;
      if (stopped) return;

      switch (result.kind) {
        case "saved": {
          offlineStep = 0;
          deps.mirror.clear(sending.id);
          deps.onSaved(result.doc);
          if (pending === sending) {
            pending = null;
            firstChangeAt = null;
            deps.onState("saved");
          } else {
            // A newer edit arrived while this save was in flight. It is
            // still only mirrored under the just-cleared id, so rewrite it
            // before the next attempt is scheduled. Re-stamp firstChangeAt
            // too: this is a fresh unsaved run starting now, not a
            // continuation of the run that just finished saving, so its
            // own throttle window should start from here.
            if (pending) deps.mirror.write(pending);
            firstChangeAt = Date.now();
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
        case "error": {
          paused = true;
          clearTimer();
          deps.onState("unsaved");
          deps.onError(result.message);
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
    })();

    inFlightPromise = attempt;
    await attempt;
  }

  const onVisibility = () => {
    if (deps.isHidden?.() ?? false) void flush();
  };

  async function flush(): Promise<void> {
    // Wait out any save already on the wire rather than racing a second PUT
    // of the same base rev alongside it. Once it settles, try again: an edit
    // that arrived during that save is still only in memory and the mirror,
    // and a suspending tab will not get another chance.
    if (inFlightPromise) await inFlightPromise;
    clearTimer();
    await run();
  }

  deps.target?.addEventListener("visibilitychange", onVisibility);

  return {
    changed(doc) {
      if (pending === null) firstChangeAt = Date.now();
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
      firstChangeAt = Date.now();
      offlineStep = 0;
      scheduleNormal();
    },
    reset() {
      pending = null;
      paused = false;
      forceNext = false;
      offlineStep = 0;
      firstChangeAt = null;
      clearTimer();
    },
    stop() {
      stopped = true;
      clearTimer();
      pending = null;
      firstChangeAt = null;
      deps.target?.removeEventListener("visibilitychange", onVisibility);
    },
  };
}
