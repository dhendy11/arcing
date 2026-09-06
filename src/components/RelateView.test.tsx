// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { useArcStore } from "@/client/store";
import { newArcDoc } from "@/core/doc";
import { splitAt } from "@/core/split";
import type { ArcDoc } from "@/core/types";
import { piperRomansDoc } from "@/fixtures/piperRomans";
import { RelateView } from "./RelateView";

function fourProps(): ArcDoc {
  let doc = newArcDoc({
    id: "a-1", reference: "Romans 12:1-2", canonical: "Romans 12:1-2", source: "paste",
    text: "one two three four", verses: [], now: new Date("2026-09-05T15:00:00Z"),
  });
  for (const at of [4, 8, 14]) doc = splitAt(doc, at);
  return doc;
}

beforeEach(() => {
  useArcStore.setState({ doc: null, saveState: "saved", selection: [], conflictDoc: null });
});

async function select(testIdSelector: string, container: HTMLElement): Promise<void> {
  await userEvent.click(container.querySelector(testIdSelector) as Element);
}

/** Draw AcPur over p1 and p2 and hand back the resulting document. */
async function drawAcPur(): Promise<ArcDoc> {
  const onChange = vi.fn();
  const { container } = render(<RelateView doc={fourProps()} onChange={onChange} />);
  await select('[data-prop="p1"]', container);
  await select('[data-prop="p2"]', container);
  await userEvent.click(screen.getByTestId("rel-AcPur"));
  return onChange.mock.calls[0][0] as ArcDoc;
}

test("selecting two neighbours and picking Ground draws the arc", async () => {
  const onChange = vi.fn();
  const { container } = render(<RelateView doc={fourProps()} onChange={onChange} />);

  await select('[data-prop="p1"]', container);
  await select('[data-prop="p2"]', container);
  await userEvent.click(screen.getByTestId("rel-G"));

  const next = onChange.mock.calls[0][0] as ArcDoc;
  expect(next.arcs).toHaveLength(1);
  expect(next.arcs[0].rel).toBe("G");
  expect(next.arcs[0].members).toEqual([{ kind: "prop", ref: "p1" }, { kind: "prop", ref: "p2" }]);
});

test("a non-adjacent selection disables every row and says Select neighbours", async () => {
  const { container } = render(<RelateView doc={fourProps()} onChange={vi.fn()} />);

  await select('[data-prop="p1"]', container);
  await select('[data-prop="p3"]', container);

  const rows = screen.getAllByRole("button", { name: /Select neighbours/ });
  expect(rows).toHaveLength(18);
  for (const row of rows) expect(row).toBeDisabled();
  expect(screen.getByTestId("rel-S")).toHaveTextContent("Select neighbours");
});

test("tapping a selected unit again deselects it", async () => {
  const { container } = render(<RelateView doc={fourProps()} onChange={vi.fn()} />);
  await select('[data-prop="p1"]', container);
  expect(container.querySelector('[data-prop="p1"]')).toHaveAttribute("data-selected", "true");
  await select('[data-prop="p1"]', container);
  expect(container.querySelector('[data-prop="p1"]')).toHaveAttribute("data-selected", "false");
});

test("an Ac-Pur arc puts a circle target on each of its two members", async () => {
  const next = await drawAcPur();
  const { container: after } = render(<RelateView doc={next} onChange={vi.fn()} />);
  expect(after.querySelectorAll('[data-circle^="a1:"]')).toHaveLength(2);
});

test("tapping a proposition's circle target circles that member", async () => {
  const drawn = await drawAcPur();
  const onCircled = vi.fn();
  const { container } = render(<RelateView doc={drawn} onChange={onCircled} />);

  await select('[data-circle="a1:1"]', container);

  expect((onCircled.mock.calls[0][0] as ArcDoc).arcs[0].circled).toBe(1);
});

/**
 * RULING 1. layout() puts an arc's own label target and its parent's circle
 * target for that member at the identical point, because a circled member arc
 * is circled on its own symbol. The arc label owns that tap: relabel and
 * dissolve are the structural actions and have to stay reachable. The circle
 * for an arc member is set from the parent arc's own controls instead.
 */
test("tapping an arc member's circle target selects that arc rather than circling it", async () => {
  const onChange = vi.fn();
  const { container } = render(<RelateView doc={piperRomansDoc()} onChange={onChange} />);

  await select('[data-circle="a3:1"]', container);

  expect(onChange).not.toHaveBeenCalled();
  expect(container.querySelector('[data-arc="a2"]')).toHaveAttribute("data-selected", "true");
  expect(screen.getByRole("button", { name: "Dissolve" })).toBeInTheDocument();
});

test("a circling arc's own controls move the circle onto an arc member", async () => {
  const onChange = vi.fn();
  const { container } = render(<RelateView doc={piperRomansDoc()} onChange={onChange} />);

  await select('[data-arc="a3"]', container);
  await userEvent.click(screen.getByTestId("circle-member-1"));

  const next = onChange.mock.calls[0][0] as ArcDoc;
  expect(next.arcs.find((a) => a.id === "a3")?.circled).toBe(1);
});

test("an arc that does not circle offers no circle control", async () => {
  const { container } = render(<RelateView doc={piperRomansDoc()} onChange={vi.fn()} />);
  await select('[data-arc="a1"]', container);
  expect(screen.queryByTestId("circle-member-0")).toBeNull();
});

test("an arc still missing its circle says so", async () => {
  const drawn = await drawAcPur();
  const { container } = render(<RelateView doc={drawn} onChange={vi.fn()} />);

  await select('[data-arc="a1"]', container);

  expect(screen.getByTestId("circle-missing")).toBeInTheDocument();
});

test("tapping an arc offers Relabel and Dissolve", async () => {
  const onChange = vi.fn();
  const { container } = render(<RelateView doc={piperRomansDoc()} onChange={onChange} />);

  await select('[data-arc="a1"]', container);
  await userEvent.click(screen.getByRole("button", { name: "Dissolve" }));

  const next = onChange.mock.calls[0][0] as ArcDoc;
  expect(next.arcs.map((a) => a.id)).toEqual([]);
});

test("relabelling an arc keeps its members", async () => {
  const onChange = vi.fn();
  const { container } = render(<RelateView doc={piperRomansDoc()} onChange={onChange} />);

  await select('[data-arc="a1"]', container);
  await userEvent.click(screen.getByRole("button", { name: "Relabel" }));
  await userEvent.click(screen.getByTestId("rel-Cf"));

  const next = onChange.mock.calls[0][0] as ArcDoc;
  const relabelled = next.arcs.find((a) => a.id === "a1");
  expect(relabelled?.rel).toBe("Cf");
  expect(relabelled?.members).toHaveLength(2);
});

test("dissolving an arc with parents warns which come apart", async () => {
  const { container } = render(<RelateView doc={piperRomansDoc()} onChange={vi.fn()} />);
  await select('[data-arc="a1"]', container);
  expect(screen.getByTestId("dissolve-warning")).toHaveTextContent("a1, a2, a3");
});
