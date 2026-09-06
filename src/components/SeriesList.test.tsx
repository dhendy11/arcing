// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import type { ArcSummary } from "@/core/types";
import { SeriesList } from "./SeriesList";

const older: ArcSummary = {
  id: "2026-08-29-romans-6-1-2", reference: "Romans 6:1-2", status: "complete",
  createdAt: "2026-08-29T14:00:00.000Z", updatedAt: "2026-08-29T15:00:00.000Z",
  mainPoint: "Grace is no licence to sin.",
};

const newer: ArcSummary = {
  id: "2026-09-05-romans-12-1-2", reference: "Romans 12:1-2", status: "relating",
  createdAt: "2026-09-05T14:00:00.000Z", updatedAt: "2026-09-05T15:00:00.000Z",
  mainPoint: "",
};

test("an empty series shows one line", () => {
  render(<SeriesList items={[]} onOpen={vi.fn()} onNew={vi.fn()} />);
  expect(screen.getByText("No arcs yet. Start one.")).toBeInTheDocument();
});

test("arcs are listed newest first however they arrive", () => {
  render(<SeriesList items={[older, newer]} onOpen={vi.fn()} onNew={vi.fn()} />);
  const rows = screen.getAllByRole("listitem");
  expect(within(rows[0]).getByText("Romans 12:1-2")).toBeInTheDocument();
  expect(within(rows[1]).getByText("Romans 6:1-2")).toBeInTheDocument();
});

test("a row carries the date, the reference, the status and the main point", () => {
  render(<SeriesList items={[older]} onOpen={vi.fn()} onNew={vi.fn()} />);
  const row = screen.getAllByRole("listitem")[0];
  expect(within(row).getByText("2026-08-29")).toBeInTheDocument();
  expect(within(row).getByText("Romans 6:1-2")).toBeInTheDocument();
  expect(within(row).getByText("complete")).toBeInTheDocument();
  expect(within(row).getByText("Grace is no licence to sin.")).toBeInTheDocument();
});

test("the row prints the id's own date, not the UTC day off createdAt", async () => {
  // Filed at 21:00 on Saturday in America/New_York, which is Sunday in UTC.
  // The id is the record of the day the arc belongs to; the timestamp is
  // not, and printing it would file a Saturday-night arc under Sunday on
  // the one surface where the dated series is the point.
  const lateSaturday: ArcSummary = {
    id: "2026-09-05-romans-8-28", reference: "Romans 8:28", status: "split",
    createdAt: "2026-09-06T01:00:00.000Z", updatedAt: "2026-09-06T01:00:00.000Z",
    mainPoint: "",
  };
  render(<SeriesList items={[lateSaturday]} onOpen={vi.fn()} onNew={vi.fn()} />);
  const row = screen.getAllByRole("listitem")[0];
  expect(within(row).getByText("2026-09-05")).toBeInTheDocument();
  expect(within(row).queryByText("2026-09-06")).toBeNull();
});

test("tapping a row opens that arc", async () => {
  const onOpen = vi.fn();
  render(<SeriesList items={[newer]} onOpen={onOpen} onNew={vi.fn()} />);
  await userEvent.click(screen.getByRole("button", { name: /Romans 12:1-2/ }));
  expect(onOpen).toHaveBeenCalledWith("2026-09-05-romans-12-1-2");
});

test("New arc is always offered", async () => {
  const onNew = vi.fn();
  render(<SeriesList items={[]} onOpen={vi.fn()} onNew={onNew} />);
  await userEvent.click(screen.getByRole("button", { name: "New arc" }));
  expect(onNew).toHaveBeenCalledTimes(1);
});
