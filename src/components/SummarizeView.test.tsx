// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import type { ArcDoc } from "@/core/types";
import { piperRomansDoc } from "@/fixtures/piperRomans";
import { SummarizeView } from "./SummarizeView";

function ready(): ArcDoc {
  const doc = piperRomansDoc();
  return {
    ...doc,
    summary: {
      mainPoint: "Be transformed so that you present your bodies to God.",
      levels: [{ text: "God's mercies are the ground.", connector: "" }],
      whyItMatters: "It reframes obedience as worship.",
    },
  };
}

test("nothing is prefilled on a fresh arc", () => {
  render(<SummarizeView doc={piperRomansDoc()} onChange={vi.fn()} />);
  expect(screen.getByLabelText("Main point")).toHaveValue("");
  expect(screen.getByLabelText("Why it matters")).toHaveValue("");
  expect(screen.queryByLabelText("Level 1")).toBeNull();
});

test("typing the main point reports the edit", async () => {
  const onChange = vi.fn();
  render(<SummarizeView doc={piperRomansDoc()} onChange={onChange} />);
  await userEvent.type(screen.getByLabelText("Main point"), "G");
  expect((onChange.mock.calls[0][0] as ArcDoc).summary.mainPoint).toBe("G");
});

test("adding a level appends it above the previous one", async () => {
  const onChange = vi.fn();
  render(<SummarizeView doc={ready()} onChange={onChange} />);
  await userEvent.click(screen.getByRole("button", { name: "Add level" }));
  const next = onChange.mock.calls[0][0] as ArcDoc;
  expect(next.summary.levels).toHaveLength(2);
  expect(next.summary.levels[1].text).toBe("");
});

test("typing into the connector field reports the edit", async () => {
  const onChange = vi.fn();
  const doc = ready();
  const two: ArcDoc = {
    ...doc,
    summary: {
      ...doc.summary,
      levels: [{ text: "bottom", connector: "" }, { text: "top", connector: "" }],
    },
  };
  render(<SummarizeView doc={two} onChange={onChange} />);
  await userEvent.type(screen.getByLabelText("Connector above level 1"), "so");
  expect((onChange.mock.calls[0][0] as ArcDoc).summary.levels[0].connector).toBe("s");
});

test("the topmost level has no connector field and stores an empty connector", async () => {
  const doc = ready();
  const two: ArcDoc = {
    ...doc,
    summary: {
      ...doc.summary,
      levels: [{ text: "bottom", connector: "therefore" }, { text: "top", connector: "" }],
    },
  };
  render(<SummarizeView doc={two} onChange={vi.fn()} />);
  expect(screen.getByLabelText("Connector above level 1")).toHaveValue("therefore");
  expect(screen.queryByLabelText("Connector above level 2")).toBeNull();
});

test("removing a level with text confirms first, then keeps the topmost connector empty", async () => {
  const onChange = vi.fn();
  const doc = ready();
  const two: ArcDoc = {
    ...doc,
    summary: {
      ...doc.summary,
      levels: [{ text: "bottom", connector: "therefore" }, { text: "top", connector: "" }],
    },
  };
  render(<SummarizeView doc={two} onChange={onChange} />);
  await userEvent.click(screen.getByRole("button", { name: "Remove level 2" }));
  expect(onChange).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole("button", { name: "Remove anyway" }));
  const next = onChange.mock.calls[0][0] as ArcDoc;
  expect(next.summary.levels).toEqual([{ text: "bottom", connector: "" }]);
});

test("removing an empty level removes it on one tap, no confirm", async () => {
  const onChange = vi.fn();
  const doc = ready();
  const two: ArcDoc = {
    ...doc,
    summary: {
      ...doc.summary,
      levels: [{ text: "bottom", connector: "" }, { text: "", connector: "" }],
    },
  };
  render(<SummarizeView doc={two} onChange={onChange} />);
  await userEvent.click(screen.getByRole("button", { name: "Remove level 2" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  const next = onChange.mock.calls[0][0] as ArcDoc;
  expect(next.summary.levels).toEqual([{ text: "bottom", connector: "" }]);
});

test("moving a level up reorders it and clears the new topmost connector", async () => {
  const onChange = vi.fn();
  const doc = ready();
  const two: ArcDoc = {
    ...doc,
    summary: {
      ...doc.summary,
      levels: [{ text: "bottom", connector: "therefore" }, { text: "top", connector: "" }],
    },
  };
  render(<SummarizeView doc={two} onChange={onChange} />);
  await userEvent.click(screen.getByRole("button", { name: "Move level 1 up" }));
  const next = onChange.mock.calls[0][0] as ArcDoc;
  expect(next.summary.levels.map((l) => l.text)).toEqual(["top", "bottom"]);
  expect(next.summary.levels[1].connector).toBe("");
});

test("Mark complete is disabled and lists what is missing", () => {
  render(<SummarizeView doc={piperRomansDoc()} onChange={vi.fn()} />);
  expect(screen.getByRole("button", { name: "Mark complete" })).toBeDisabled();
  const missing = screen.getByTestId("missing-list");
  expect(missing).toHaveTextContent("A main point sentence");
  expect(missing).toHaveTextContent("At least one level with text");
});

test("Mark complete sets the flag and the derived status", async () => {
  const onChange = vi.fn();
  render(<SummarizeView doc={ready()} onChange={onChange} />);
  const button = screen.getByRole("button", { name: "Mark complete" });
  expect(button).toBeEnabled();

  await userEvent.click(button);
  const next = onChange.mock.calls[0][0] as ArcDoc;
  expect(next.markedComplete).toBe(true);
  expect(next.status).toBe("complete");
});

test("a complete arc is still editable", async () => {
  const onChange = vi.fn();
  const complete: ArcDoc = { ...ready(), markedComplete: true, status: "complete" };
  render(<SummarizeView doc={complete} onChange={onChange} />);
  expect(screen.getByLabelText("Main point")).toBeEnabled();
  await userEvent.type(screen.getByLabelText("Why it matters"), "!");
  expect(onChange).toHaveBeenCalled();
});

test("editing a complete arc so it no longer qualifies drops it out of complete", async () => {
  const onChange = vi.fn();
  const complete: ArcDoc = { ...ready(), markedComplete: true, status: "complete" };
  render(<SummarizeView doc={complete} onChange={onChange} />);
  await userEvent.clear(screen.getByLabelText("Main point"));
  const calls = onChange.mock.calls;
  const next = calls[calls.length - 1][0] as ArcDoc;
  expect(next.summary.mainPoint).toBe("");
  expect(next.status).toBe("relating");
});

test("an unfinished circle blocks completion and says which arc", () => {
  const doc = ready();
  const uncircled: ArcDoc = { ...doc, arcs: doc.arcs.map((a) => (a.id === "a2" ? { ...a, circled: null } : a)) };
  render(<SummarizeView doc={uncircled} onChange={vi.fn()} />);
  expect(screen.getByTestId("missing-list")).toHaveTextContent("A circled member on the Action-Purpose arc (a2)");
});
