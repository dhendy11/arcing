// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import SeriesPage from "./page";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

afterEach(() => {
  vi.unstubAllGlobals();
  push.mockClear();
});

function stubFetch(status: number, body: unknown): void {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(body), { status })));
}

test("a confirmed empty list shows the pinned empty line", async () => {
  stubFetch(200, []);
  render(<SeriesPage />);

  expect(await screen.findByText("No arcs yet. Start one.")).toBeInTheDocument();
});

test("a fetch that rejects shows a failure line, not the empty line", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      throw new Error("network down");
    }),
  );
  render(<SeriesPage />);

  expect(await screen.findByText("Could not load your arcs.")).toBeInTheDocument();
  expect(screen.queryByText("No arcs yet. Start one.")).toBeNull();
});

test("a non-array response shows the failure line instead of crashing", async () => {
  stubFetch(500, { error: "boom" });
  render(<SeriesPage />);

  expect(await screen.findByText("Could not load your arcs.")).toBeInTheDocument();
  expect(screen.queryByText("No arcs yet. Start one.")).toBeNull();
});

test("a loaded list renders its rows", async () => {
  stubFetch(200, [
    {
      id: "2026-09-05-romans-12-1-2",
      reference: "Romans 12:1-2",
      status: "relating",
      createdAt: "2026-09-05T14:00:00.000Z",
      updatedAt: "2026-09-05T15:00:00.000Z",
      mainPoint: "",
    },
  ]);
  render(<SeriesPage />);

  expect(await screen.findByText("Romans 12:1-2")).toBeInTheDocument();
});
