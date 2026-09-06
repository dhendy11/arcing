// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { newArcDoc } from "@/core/doc";
import { ESV_NOTICE } from "@/core/tokens";
import type { ArcDoc } from "@/core/types";
import { ArcFrame } from "./ArcFrame";

afterEach(() => {
  vi.unstubAllGlobals();
});

function doc(): ArcDoc {
  return newArcDoc({
    id: "a-1", reference: "Romans 12:1-2", canonical: "Romans 12:1-2", source: "paste",
    text: "one two", verses: [], now: new Date("2026-09-05T15:00:00Z"),
  });
}

function frame(overrides: Partial<React.ComponentProps<typeof ArcFrame>> = {}) {
  const props: React.ComponentProps<typeof ArcFrame> = {
    reference: "Romans 12:1-2",
    tab: "split",
    onTab: vi.fn(),
    onSeries: vi.fn(),
    saveState: "saved",
    canSummarize: true,
    canUndo: true,
    canRedo: true,
    onUndo: vi.fn(),
    onRedo: vi.fn(),
    showNotice: true,
    conflictDoc: null,
    onReload: vi.fn(),
    onOverwrite: vi.fn(),
    needsLogin: false,
    onSignedIn: vi.fn(),
    mirrored: null,
    onRestore: vi.fn(),
    onDiscard: vi.fn(),
    children: <p>screen body</p>,
    ...overrides,
  };
  render(<ArcFrame {...props} />);
  return props;
}

test("the frame carries the series link, the reference and the three tabs", async () => {
  const props = frame();
  expect(screen.getByText("Romans 12:1-2")).toBeInTheDocument();
  for (const name of ["Split", "Relate", "Summarize"]) {
    expect(screen.getByRole("tab", { name })).toBeInTheDocument();
  }
  await userEvent.click(screen.getByRole("tab", { name: "Relate" }));
  expect(props.onTab).toHaveBeenCalledWith("relate");

  await userEvent.click(screen.getByRole("button", { name: "Series" }));
  expect(props.onSeries).toHaveBeenCalledTimes(1);
});

test("the save chip shows each of the five states", () => {
  for (const [state, label] of [
    ["saved", "Saved"], ["saving", "Saving"], ["unsaved", "Unsaved"],
    ["offline", "Offline"], ["conflict", "Conflict"],
  ] as const) {
    const { unmount } = render(
      <ArcFrame
        reference="Romans 12:1-2" tab="split" onTab={vi.fn()} onSeries={vi.fn()}
        saveState={state} canSummarize canUndo={false} canRedo={false} onUndo={vi.fn()} onRedo={vi.fn()}
        showNotice={false} conflictDoc={null} onReload={vi.fn()} onOverwrite={vi.fn()}
        needsLogin={false} onSignedIn={vi.fn()} mirrored={null} onRestore={vi.fn()} onDiscard={vi.fn()}
      >
        <p>body</p>
      </ArcFrame>
    );
    expect(screen.getByTestId("save-chip")).toHaveTextContent(label);
    unmount();
  }
});

test("the Summarize tab is closed until one arc spans the passage", () => {
  frame({ canSummarize: false });
  expect(screen.getByRole("tab", { name: "Summarize" })).toBeDisabled();
  expect(screen.getByRole("tab", { name: "Relate" })).toBeEnabled();
});

test("the ESV notice appears verbatim under a view showing passage text", () => {
  frame({ showNotice: true });
  expect(screen.getByTestId("esv-notice")).toHaveTextContent(ESV_NOTICE);
  expect(screen.getByRole("link", { name: "ESV" })).toHaveAttribute("href", "https://www.esv.org");
});

test("a view with no passage text carries no notice", () => {
  frame({ showNotice: false });
  expect(screen.queryByTestId("esv-notice")).toBeNull();
});

test("Undo and Redo call their handlers and disable when there is nothing to do", async () => {
  const props = frame();
  await userEvent.click(screen.getByRole("button", { name: "Undo" }));
  await userEvent.click(screen.getByRole("button", { name: "Redo" }));
  expect(props.onUndo).toHaveBeenCalledTimes(1);
  expect(props.onRedo).toHaveBeenCalledTimes(1);
});

test("Undo and Redo are disabled when the history is empty", () => {
  frame({ canUndo: false, canRedo: false });
  expect(screen.getByRole("button", { name: "Undo" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Redo" })).toBeDisabled();
});

test("the keyboard shortcut also undoes and redoes", async () => {
  const props = frame();
  await userEvent.keyboard("{Meta>}z{/Meta}");
  expect(props.onUndo).toHaveBeenCalledTimes(1);
  await userEvent.keyboard("{Shift>}{Meta>}z{/Meta}{/Shift}");
  expect(props.onRedo).toHaveBeenCalledTimes(1);
});

test("a conflict shows a banner offering Reload and Overwrite", async () => {
  const props = frame({ saveState: "conflict", conflictDoc: { ...doc(), rev: 7 } });
  const banner = screen.getByRole("alert");
  expect(banner).toHaveTextContent("This arc changed somewhere else.");
  await userEvent.click(screen.getByRole("button", { name: "Reload" }));
  expect(props.onReload).toHaveBeenCalledTimes(1);
  await userEvent.click(screen.getByRole("button", { name: "Overwrite" }));
  expect(props.onOverwrite).toHaveBeenCalledTimes(1);
});

test("an expired session opens an inline login that retries the save", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));
  const props = frame({ needsLogin: true });
  expect(screen.getByRole("dialog", { name: "Sign in again" })).toBeInTheDocument();

  await userEvent.type(screen.getByLabelText("Password"), "hunter2");
  await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
  expect(props.onSignedIn).toHaveBeenCalledTimes(1);
});

test("an unsaved mirror offers Restore or Discard", async () => {
  const props = frame({ mirrored: doc() });
  expect(screen.getByText("There are unsaved changes on this device.")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Restore" }));
  expect(props.onRestore).toHaveBeenCalledTimes(1);
  await userEvent.click(screen.getByRole("button", { name: "Discard" }));
  expect(props.onDiscard).toHaveBeenCalledTimes(1);
});
