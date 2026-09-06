// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { LoginForm } from "./LoginForm";

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFetch(status: number): void {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({}), { status })));
}

test("a wrong password shows one line under the field", async () => {
  stubFetch(401);
  const onSignedIn = vi.fn();
  render(<LoginForm onSignedIn={onSignedIn} />);

  await userEvent.type(screen.getByLabelText("Password"), "nope");
  await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

  expect(await screen.findByRole("alert")).toHaveTextContent("That password is not right.");
  expect(onSignedIn).not.toHaveBeenCalled();
});

test("the right password signs in", async () => {
  stubFetch(200);
  const onSignedIn = vi.fn();
  render(<LoginForm onSignedIn={onSignedIn} />);

  await userEvent.type(screen.getByLabelText("Password"), "hunter2");
  await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

  expect(onSignedIn).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("alert")).toBeNull();
});

test("too many attempts says so rather than blaming the password", async () => {
  stubFetch(429);
  render(<LoginForm onSignedIn={vi.fn()} />);

  await userEvent.type(screen.getByLabelText("Password"), "nope");
  await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

  expect(await screen.findByRole("alert")).toHaveTextContent("Too many attempts. Wait a minute.");
});
