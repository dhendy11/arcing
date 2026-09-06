"use client";

import { useState, type FormEvent } from "react";
import { login } from "@/client/api";

const MESSAGES = {
  bad: "That password is not right.",
  throttled: "Too many attempts. Wait a minute.",
  offline: "Could not reach the server.",
} as const;

export function LoginForm({ onSignedIn }: { onSignedIn: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await login(password);
    setBusy(false);
    if (result === "ok") {
      onSignedIn();
      return;
    }
    setError(MESSAGES[result]);
  }

  return (
    <form onSubmit={submit} className="login">
      <label htmlFor="password">Password</label>
      <input
        id="password"
        name="password"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {error === null ? null : <p role="alert">{error}</p>}
      <button type="submit" disabled={busy}>
        Sign in
      </button>
    </form>
  );
}
