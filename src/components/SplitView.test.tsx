// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { createArc } from "@/core/arcTree";
import { newArcDoc } from "@/core/doc";
import { splitAt } from "@/core/split";
import type { ArcDoc } from "@/core/types";
import { SplitView } from "./SplitView";

function fresh(): ArcDoc {
  return newArcDoc({
    id: "a-1", reference: "Romans 12:1-2", canonical: "Romans 12:1-2", source: "paste",
    text: "one two three four", verses: [{ n: 1, start: 0 }, { n: 2, start: 8 }],
    now: new Date("2026-09-05T15:00:00Z"),
  });
}

test("Piper's split rules sit beside the text as static reference", () => {
  render(<SplitView doc={fresh()} onChange={vi.fn()} />);
  expect(screen.getByText(/Relative clauses usually stay inside their proposition/)).toBeInTheDocument();
  expect(screen.getByText(/participles and infinitives become their own proposition when they assert/i)).toBeInTheDocument();
});

test("verse numbers render as badges on the word they start", () => {
  render(<SplitView doc={fresh()} onChange={vi.fn()} />);
  expect(screen.getByTestId("verse-1")).toHaveTextContent("1");
  expect(screen.getByTestId("verse-2")).toHaveTextContent("2");
});

test("tapping a word starts a new proposition there", async () => {
  const onChange = vi.fn();
  render(<SplitView doc={fresh()} onChange={onChange} />);

  await userEvent.click(screen.getByTestId("word-8"));

  const next = onChange.mock.calls[0][0] as ArcDoc;
  expect(next.propositions.map((p) => p.text)).toEqual(["one two", "three four"]);
});

test("tapping the first word of a proposition changes nothing", async () => {
  const onChange = vi.fn();
  render(<SplitView doc={fresh()} onChange={onChange} />);
  await userEvent.click(screen.getByTestId("word-0"));
  expect(onChange).not.toHaveBeenCalled();
});

test("tapping a divider rejoins the two propositions", async () => {
  const onChange = vi.fn();
  render(<SplitView doc={splitAt(fresh(), 8)} onChange={onChange} />);

  await userEvent.click(screen.getByRole("button", { name: "Rejoin proposition 2 into 1" }));

  const next = onChange.mock.calls[0][0] as ArcDoc;
  expect(next.propositions).toHaveLength(1);
});

test("a split that would dissolve arcs asks first and names them", async () => {
  const onChange = vi.fn();
  let doc = splitAt(fresh(), 8);
  doc = createArc(doc, [{ kind: "prop", ref: "p1" }, { kind: "prop", ref: "p2" }], "G");
  render(<SplitView doc={doc} onChange={onChange} />);

  await userEvent.click(screen.getByTestId("word-4"));
  expect(onChange).not.toHaveBeenCalled();

  const dialog = screen.getByRole("dialog", { name: "This dissolves arcs" });
  expect(dialog).toHaveTextContent("a1 (Ground)");

  await userEvent.click(screen.getByRole("button", { name: "Split anyway" }));
  const next = onChange.mock.calls[0][0] as ArcDoc;
  expect(next.arcs).toEqual([]);
  expect(next.propositions).toHaveLength(3);
});

test("cancelling the confirm leaves the document alone", async () => {
  const onChange = vi.fn();
  let doc = splitAt(fresh(), 8);
  doc = createArc(doc, [{ kind: "prop", ref: "p1" }, { kind: "prop", ref: "p2" }], "G");
  render(<SplitView doc={doc} onChange={onChange} />);

  await userEvent.click(screen.getByTestId("word-4"));
  await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

  expect(onChange).not.toHaveBeenCalled();
  expect(screen.queryByRole("dialog")).toBeNull();
});

test("a rejoin that would dissolve arcs asks the same way", async () => {
  const onChange = vi.fn();
  let doc = splitAt(fresh(), 8);
  doc = createArc(doc, [{ kind: "prop", ref: "p1" }, { kind: "prop", ref: "p2" }], "G");
  render(<SplitView doc={doc} onChange={onChange} />);

  await userEvent.click(screen.getByRole("button", { name: "Rejoin proposition 2 into 1" }));
  expect(screen.getByRole("dialog", { name: "This dissolves arcs" })).toHaveTextContent("a1 (Ground)");
});

test("an autosave echo while the confirm modal is open does not dismiss it", async () => {
  const onChange = vi.fn();
  let doc = splitAt(fresh(), 8);
  doc = createArc(doc, [{ kind: "prop", ref: "p1" }, { kind: "prop", ref: "p2" }], "G");
  const { rerender } = render(<SplitView doc={doc} onChange={onChange} />);

  await userEvent.click(screen.getByTestId("word-4"));
  expect(screen.getByRole("dialog", { name: "This dissolves arcs" })).toBeInTheDocument();

  // A completed autosave hands SplitView a freshly parsed doc object (new
  // references throughout, exactly like a JSON round trip), with only rev
  // and updatedAt actually different. That must not be mistaken for the
  // undo/redo case the modal-reset guards against.
  const echoed: ArcDoc = {
    ...doc,
    rev: doc.rev + 1,
    updatedAt: "2026-09-05T15:00:01Z",
    propositions: doc.propositions.map((p) => ({ ...p })),
    arcs: doc.arcs.map((a) => ({ ...a, members: a.members.map((m) => ({ ...m })) })),
  };
  rerender(<SplitView doc={echoed} onChange={onChange} />);

  expect(screen.getByRole("dialog", { name: "This dissolves arcs" })).toBeInTheDocument();
});
