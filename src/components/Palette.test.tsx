// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { newArcDoc } from "@/core/doc";
import { splitAt } from "@/core/split";
import type { ArcDoc, Member } from "@/core/types";
import { Palette } from "./Palette";

function fourProps(): ArcDoc {
  let doc = newArcDoc({
    id: "a-1", reference: "Romans 12:1-2", canonical: "Romans 12:1-2", source: "paste",
    text: "one two three four", verses: [], now: new Date("2026-09-05T15:00:00Z"),
  });
  for (const at of [4, 8, 14]) doc = splitAt(doc, at);
  return doc;
}

const prop = (ref: string): Member => ({ kind: "prop", ref });

test("all 18 relationships are on screen under four headings", () => {
  render(<Palette doc={fourProps()} units={[prop("p1"), prop("p2")]} onPick={vi.fn()} />);
  expect(screen.getAllByRole("button", { name: /./ })).toHaveLength(18);
  for (const heading of [
    "Coordinate",
    "Support by restatement",
    "Support by distinct statement",
    "Support by contrary statement",
  ]) {
    expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
  }
});

test("each row carries its one line definition", () => {
  render(<Palette doc={fourProps()} units={[prop("p1"), prop("p2")]} onPick={vi.fn()} />);
  expect(screen.getByText("An action and its intended result.")).toBeInTheDocument();
});

test("Ground and Inference carry Piper's warning", () => {
  render(<Palette doc={fourProps()} units={[prop("p1"), prop("p2")]} onPick={vi.fn()} />);
  expect(screen.getAllByTestId("ground-inference-warning")).toHaveLength(1);
  expect(screen.getByTestId("ground-inference-warning")).toHaveTextContent(
    "In Ground the conclusion comes first; in Inference it comes second."
  );
});

test("the three circling relationships say so", () => {
  render(<Palette doc={fourProps()} units={[prop("p1"), prop("p2")]} onPick={vi.fn()} />);
  expect(screen.getByTestId("rel-AcPur")).toHaveTextContent("circle one");
  expect(screen.getByTestId("rel-AcRes")).toHaveTextContent("circle one");
  expect(screen.getByTestId("rel-SitR")).toHaveTextContent("circle one");
  expect(screen.getByTestId("rel-G")).not.toHaveTextContent("circle one");
});

test("three adjacent units enable only Series, Progression, Alternative and Bilateral", () => {
  render(
    <Palette doc={fourProps()} units={[prop("p1"), prop("p2"), prop("p3")]} onPick={vi.fn()} />
  );
  for (const code of ["S", "P", "A", "BL"]) {
    expect(screen.getByTestId(`rel-${code}`)).toBeEnabled();
  }
  for (const code of ["G", "Inf", "AcPur", "NegPos", "Csv", "SitR", "T", "L"]) {
    expect(screen.getByTestId(`rel-${code}`)).toBeDisabled();
  }
});

test("a disabled row says why", () => {
  render(<Palette doc={fourProps()} units={[prop("p1"), prop("p2"), prop("p3")]} onPick={vi.fn()} />);
  expect(screen.getByTestId("rel-G")).toHaveTextContent("Takes exactly 2");
});

test("picking a relationship reports its code", async () => {
  const onPick = vi.fn();
  render(<Palette doc={fourProps()} units={[prop("p1"), prop("p2")]} onPick={onPick} />);
  await userEvent.click(screen.getByTestId("rel-G"));
  expect(onPick).toHaveBeenCalledWith("G");
});
