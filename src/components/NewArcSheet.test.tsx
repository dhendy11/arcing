// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { NewArcSheet } from "./NewArcSheet";

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubCreate(status: number, body: unknown = {}): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

test("Fetch posts the reference alone so the server resolves the passage", async () => {
  const fetchMock = stubCreate(201, { id: "x" });
  const onCreated = vi.fn();
  render(<NewArcSheet onCreated={onCreated} onClose={vi.fn()} />);

  await userEvent.type(screen.getByLabelText("Reference"), "Romans 12:1-2");
  await userEvent.click(screen.getByRole("button", { name: "Create" }));

  expect(JSON.parse(String(fetchMock.mock.calls[0][1].body))).toEqual({ reference: "Romans 12:1-2" });
  expect(onCreated).toHaveBeenCalledTimes(1);
});

test("Paste posts the reference and the text", async () => {
  const fetchMock = stubCreate(201, { id: "x" });
  render(<NewArcSheet onCreated={vi.fn()} onClose={vi.fn()} />);

  await userEvent.click(screen.getByRole("tab", { name: "Paste" }));
  await userEvent.type(screen.getByLabelText("Reference"), "Romans 12:1-2");
  await userEvent.type(screen.getByLabelText("Passage text"), "I beseech you.");
  await userEvent.click(screen.getByRole("button", { name: "Create" }));

  expect(JSON.parse(String(fetchMock.mock.calls[0][1].body))).toEqual({
    reference: "Romans 12:1-2",
    text: "I beseech you.",
  });
});

test("a 503 switches to Paste and says why", async () => {
  stubCreate(503, { error: "esv_unavailable" });
  render(<NewArcSheet onCreated={vi.fn()} onClose={vi.fn()} />);

  await userEvent.type(screen.getByLabelText("Reference"), "Romans 12:1-2");
  await userEvent.click(screen.getByRole("button", { name: "Create" }));

  expect(await screen.findByRole("alert")).toHaveTextContent("ESV unavailable, paste the text");
  expect(screen.getByRole("tab", { name: "Paste" })).toHaveAttribute("aria-selected", "true");
  expect(screen.getByLabelText("Passage text")).toBeInTheDocument();
});

test("the reference survives the switch to Paste", async () => {
  stubCreate(503, { error: "esv_unavailable" });
  render(<NewArcSheet onCreated={vi.fn()} onClose={vi.fn()} />);

  await userEvent.type(screen.getByLabelText("Reference"), "Romans 12:1-2");
  await userEvent.click(screen.getByRole("button", { name: "Create" }));

  expect(await screen.findByLabelText("Reference")).toHaveValue("Romans 12:1-2");
});
