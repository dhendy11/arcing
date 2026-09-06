// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { piperRomansDoc } from "@/fixtures/piperRomans";
import { ArcSvg } from "./ArcSvg";

function draw(overrides: Partial<React.ComponentProps<typeof ArcSvg>> = {}) {
  const props: React.ComponentProps<typeof ArcSvg> = {
    doc: piperRomansDoc(),
    selection: [],
    onSelectUnit: vi.fn(),
    onCircle: vi.fn(),
    ...overrides,
  };
  const { container } = render(<ArcSvg {...props} />);
  return { container, props };
}

test("there is one hit target per proposition and per arc", () => {
  const { container } = draw();
  expect(container.querySelectorAll("[data-prop]")).toHaveLength(4);
  expect(container.querySelectorAll("[data-arc]")).toHaveLength(3);
});

test("the arc hit target is a 44 px circle on the label, not the whole group", () => {
  const { container } = draw();
  const target = container.querySelector('[data-arc="a1"]') as SVGCircleElement;
  expect(target.tagName.toLowerCase()).toBe("circle");
  expect(target.getAttribute("r")).toBe("22");
});

test("one leaf arc is drawn over every proposition", () => {
  const { container } = draw();
  expect(container.querySelectorAll("[data-leaf]")).toHaveLength(4);
});

test("the viewBox is the geometry's own size", () => {
  const { container } = draw();
  expect(container.querySelector("svg")).toHaveAttribute("viewBox", "0 0 1024 300");
});

test("the circled member is ringed and the other member is a plain target", () => {
  const { container } = draw();
  expect(container.querySelector('[data-circle="a3:0"][data-circled="true"]')).not.toBeNull();
  expect(container.querySelector('[data-circle="a3:1"][data-circled="false"]')).not.toBeNull();
});

/**
 * The one-ellipse-per-circled-member invariant. Without it a regression that
 * ringed every member of a circling arc, or none of them, passes this whole
 * file: Piper's Romans arc has exactly two circles, one on a2 and one on a3.
 */
test("exactly one ring is drawn per circled member", () => {
  const { container } = draw();
  expect(container.querySelectorAll("ellipse")).toHaveLength(2);
});

test("an arc with every circle chosen is not in the missing-circle state", () => {
  const { container } = draw();
  expect(container.querySelectorAll('[data-missing="true"]')).toHaveLength(0);
});

test("an arc still missing its circle shows amber on both targets", () => {
  const doc = piperRomansDoc();
  const uncircled = { ...doc, arcs: doc.arcs.map((a) => (a.id === "a2" ? { ...a, circled: null } : a)) };
  const { container } = draw({ doc: uncircled });
  expect(container.querySelectorAll('[data-circle^="a2:"][data-missing="true"]')).toHaveLength(2);
});

test("Negative-Positive draws as a stroke, not as lettering", () => {
  const { container } = draw();
  expect(container.querySelector('[data-arc-group="a1"] [data-negpos]')).not.toBeNull();
  expect(container.querySelector('[data-arc-group="a1"] text')).toBeNull();
});

test("an arc that letters its symbol prints the relationship symbol", () => {
  const { container } = draw();
  expect(container.querySelector('[data-arc-group="a2"] text')).toHaveTextContent("Ac/Pur");
});

test("tapping a proposition selects it", async () => {
  const { container, props } = draw();
  await userEvent.click(container.querySelector('[data-prop="p2"]') as Element);
  expect(props.onSelectUnit).toHaveBeenCalledWith({ kind: "prop", ref: "p2" });
});

test("tapping an arc label selects the arc", async () => {
  const { container, props } = draw();
  await userEvent.click(container.querySelector('[data-arc="a1"]') as Element);
  expect(props.onSelectUnit).toHaveBeenCalledWith({ kind: "arc", ref: "a1" });
});

test("tapping a circle target moves the circle to that member", async () => {
  const { container, props } = draw();
  await userEvent.click(container.querySelector('[data-circle="a3:1"]') as Element);
  expect(props.onCircle).toHaveBeenCalledWith("a3", 1);
});

test("selected units are marked so they can be tinted", () => {
  const { container } = draw({ selection: [{ kind: "prop", ref: "p1" }, { kind: "arc", ref: "a1" }] });
  expect(container.querySelector('[data-prop="p1"]')).toHaveAttribute("data-selected", "true");
  expect(container.querySelector('[data-prop="p2"]')).toHaveAttribute("data-selected", "false");
  expect(container.querySelector('[data-arc="a1"]')).toHaveAttribute("data-selected", "true");
  expect(container.querySelector('[data-arc-group="a1"]')).toHaveAttribute("data-selected", "true");
});

test("the proposition text is drawn line by line with its number", () => {
  draw();
  expect(screen.getByText("I beseech you by the mercies of God, brothers, to present")).toBeInTheDocument();
  expect(screen.getByText("4")).toBeInTheDocument();
});
