// @vitest-environment jsdom
//
// The wiring between the store, the autosave engine and the real PUT. The
// autosave suite cannot see any of this: it mocks save to hand the same
// document straight back, so rev never advances anywhere in it, and rev is
// the whole subject here. These tests run a fake server that increments rev
// exactly as src/app/api/arcs/[id]/route.ts does, and that refuses a write
// whose rev is not the one it holds.
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { getArc, putArc } from "@/client/api";
import { localStorageMirror } from "@/client/autosave";
import { useArcStore } from "@/client/store";
import { newArcDoc } from "@/core/doc";
import type { ArcDoc } from "@/core/types";
import { ArcWorkspace, useArcEdit } from "./ArcWorkspace";

const ID = "2026-09-05-romans-12-1-2";

// The router object has to be STABLE across renders: the workspace effect
// lists it as a dependency, so a fresh object per call re-runs the effect on
// every render, which reloads the arc, which renders again, forever.
const nav = vi.hoisted(() => ({ router: { push: () => {} } }));
vi.mock("next/navigation", () => ({
  useRouter: () => nav.router,
  usePathname: () => `/a/${ID}/split`,
}));

// Every export is stubbed rather than spread off the real module: the only
// ones this flow touches are getArc and putArc, and LoginForm's login sits
// behind a sign-in that never opens here.
vi.mock("@/client/api", () => ({
  getArc: vi.fn(),
  putArc: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  listArcs: vi.fn(),
  createArc: vi.fn(),
}));

function baseDoc(): ArcDoc {
  return newArcDoc({
    id: ID,
    reference: "Romans 12:1-2",
    canonical: "Romans 12:1-2",
    source: "paste",
    text: "I beseech you by the mercies of God",
    verses: [],
    now: new Date("2026-09-05T15:00:00Z"),
  });
}

/** What the server holds, and what every PUT was sent with. */
let stored: ArcDoc;
let sentRevs: number[];
/** Set to hold the NEXT save on the wire, so an edit can land mid-flight. */
let gate: Promise<void> | null;
let openGate: () => void;

function holdNextSave(): void {
  gate = new Promise<void>((resolve) => {
    openGate = resolve;
  });
}

/** Flush the microtasks a resolved fetch or timer leaves behind. */
async function settle(ms = 0): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

/**
 * The screen under the frame. It builds its next document from the STORE,
 * which is what every real screen does and what carries a pre-save rev into
 * an edit made while a save is in flight.
 */
function Probe() {
  const edit = useArcEdit();
  const doc = useArcStore((s) => s.doc);
  return (
    <button
      type="button"
      onClick={() => {
        if (doc) edit({ ...doc, summary: { ...doc.summary, mainPoint: `${doc.summary.mainPoint}.` } });
      }}
    >
      probe edit
    </button>
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  window.localStorage.clear();
  stored = baseDoc();
  sentRevs = [];
  gate = null;
  vi.mocked(getArc).mockImplementation(async () => JSON.parse(JSON.stringify(stored)) as ArcDoc);
  vi.mocked(putArc).mockImplementation(async (doc: ArcDoc, force = false) => {
    sentRevs.push(doc.rev);
    const held = gate;
    gate = null;
    if (held) await held;
    if (doc.rev !== stored.rev && !force) {
      return { kind: "conflict", serverDoc: JSON.parse(JSON.stringify(stored)) as ArcDoc };
    }
    stored = { ...doc, rev: stored.rev + 1, updatedAt: "2026-09-05T15:00:01.000Z" };
    return { kind: "saved", doc: JSON.parse(JSON.stringify(stored)) as ArcDoc };
  });
});

afterEach(() => {
  vi.useRealTimers();
});

async function mount(): Promise<void> {
  render(
    <ArcWorkspace id={ID}>
      <Probe />
    </ArcWorkspace>,
  );
  await settle();
}

test("an edit made while a save is in flight is sent at the rev the server now holds", async () => {
  await mount();
  const edit = screen.getByRole("button", { name: "probe edit" });

  holdNextSave();
  fireEvent.click(edit);
  await settle(1000);
  expect(sentRevs).toEqual([1]);

  // The screen edits again while that PUT is still on the wire. The store's
  // doc is still at the pre-save rev, because the response has not landed.
  fireEvent.click(edit);
  await act(async () => {
    openGate();
    await vi.advanceTimersByTimeAsync(0);
  });

  // The follow-up PUT. Sent at rev 1 it is a 409 against this client's own
  // save, and the banner that raises offers Reload, which throws the edit
  // away. It has to go out at the rev the server confirmed a moment ago.
  await settle(5000);
  expect(sentRevs).toEqual([1, 2]);
  expect(screen.queryByText(/changed somewhere else/)).toBeNull();
  expect(stored.summary.mainPoint).toBe("..");
});

test("an edit that lands mid-flight is mirrored at the rev the server now holds", async () => {
  await mount();
  const edit = screen.getByRole("button", { name: "probe edit" });

  holdNextSave();
  fireEvent.click(edit);
  await settle(1000);

  fireEvent.click(edit);
  await act(async () => {
    openGate();
    await vi.advanceTimersByTimeAsync(0);
  });

  // The tab dies HERE, inside the throttle window, before the follow-up PUT
  // goes out. Reopening loads the server's copy and reads the mirror at the
  // rev that copy carries; mirrored under the pre-save key the edit is
  // invisible, the Restore banner is never offered, and with no delete
  // affordance and no other copy the edit is simply gone.
  expect(stored.rev).toBe(2);
  const recovered = localStorageMirror(window.localStorage).read(ID, stored.rev);
  expect(recovered?.summary.mainPoint).toBe("..");
});

test("a write from somewhere else still conflicts", async () => {
  await mount();

  // Another tab saved. This client never saw that response, so its own
  // latestServerRev is still 1 and its next PUT is genuinely stale.
  stored = { ...stored, rev: stored.rev + 1, summary: { ...stored.summary, mainPoint: "elsewhere" } };

  fireEvent.click(screen.getByRole("button", { name: "probe edit" }));
  await settle(1000);

  expect(sentRevs).toEqual([1]);
  expect(screen.getByText(/changed somewhere else/)).toBeInTheDocument();
});
