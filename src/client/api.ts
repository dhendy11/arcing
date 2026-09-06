import type { ArcDoc, ArcSummary } from "@/core/types";
import type { Violation } from "@/core/validate";

export type SaveResult =
  | { kind: "saved"; doc: ArcDoc }
  | { kind: "conflict"; serverDoc: ArcDoc }
  | { kind: "unauthorized" }
  | { kind: "offline" }
  | { kind: "invalid"; violations: Violation[] }
  /** A response the client cannot make sense of: an unreadable body, an id
   * mismatch, or any other shape httpErrors.ts's badRequest() produces. This
   * is a bug in the request itself, not something editing the document can
   * fix, but it must still be a typed result: putArc is awaited from an
   * unwrapped setTimeout callback, so throwing here would be an unhandled
   * rejection with no catcher. */
  | { kind: "error"; message: string };

export type LoginResult = "ok" | "bad" | "throttled" | "offline";

export type CreateResult =
  | { kind: "created"; doc: ArcDoc }
  | { kind: "esv_unavailable" }
  | { kind: "unauthorized" }
  | { kind: "error"; message: string };

const JSON_HEADERS = { "content-type": "application/json" };

export async function login(password: string): Promise<LoginResult> {
  let res: Response;
  try {
    res = await fetch("/api/login", { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ password }) });
  } catch {
    return "offline";
  }
  if (res.ok) return "ok";
  if (res.status === 429) return "throttled";
  return "bad";
}

export async function logout(): Promise<void> {
  try {
    await fetch("/api/logout", { method: "POST" });
  } catch {
    // Signing out offline is a no-op; the cookie expires on its own.
  }
}

/** What GET /api/arcs returns: the rows, plus the ids it could not read. */
export interface ArcList {
  arcs: ArcSummary[];
  unreadable: string[];
}

export async function listArcs(): Promise<ArcList | "unauthorized"> {
  const res = await fetch("/api/arcs");
  if (res.status === 401) return "unauthorized";
  return (await res.json()) as ArcList;
}

export async function createArc(input: { reference: string; text?: string }): Promise<CreateResult> {
  let res: Response;
  try {
    res = await fetch("/api/arcs", { method: "POST", headers: JSON_HEADERS, body: JSON.stringify(input) });
  } catch {
    return { kind: "error", message: "Could not reach the server." };
  }
  if (res.status === 201) return { kind: "created", doc: (await res.json()) as ArcDoc };
  if (res.status === 503) return { kind: "esv_unavailable" };
  if (res.status === 401) return { kind: "unauthorized" };
  const body = (await res.json().catch(() => ({ error: "unknown" }))) as { error?: string };
  return { kind: "error", message: body.error ?? "unknown" };
}

export async function getArc(id: string): Promise<ArcDoc | null> {
  const res = await fetch(`/api/arcs/${id}`);
  if (!res.ok) return null;
  return (await res.json()) as ArcDoc;
}

export async function putArc(doc: ArcDoc, force = false): Promise<SaveResult> {
  let res: Response;
  try {
    res = await fetch(`/api/arcs/${doc.id}${force ? "?force=1" : ""}`, {
      method: "PUT",
      headers: JSON_HEADERS,
      body: JSON.stringify(doc),
    });
  } catch {
    return { kind: "offline" };
  }
  if (res.ok) {
    try {
      return { kind: "saved", doc: (await res.json()) as ArcDoc };
    } catch {
      return { kind: "error", message: "the server accepted the save but the response was unreadable" };
    }
  }
  if (res.status === 401) return { kind: "unauthorized" };
  if (res.status === 409) {
    try {
      const body = (await res.json()) as { doc: ArcDoc };
      return { kind: "conflict", serverDoc: body.doc };
    } catch {
      return { kind: "error", message: "a conflict response was unreadable" };
    }
  }
  if (res.status === 400) {
    // httpErrors.ts has two different 400 shapes: invalid() returns
    // {error:"invalid", violations}, badRequest() returns {error:<message>}
    // for cases like an id mismatch or an unreadable body. Branch on the
    // error field, not the status: a well-behaved client (one only ever
    // sending its own loaded doc back) should never hit the badRequest
    // shape, so that case is a bug in the request itself, not a save the
    // user can retry by editing the document. Report it as a typed "error"
    // result rather than throwing: putArc is awaited from an unwrapped
    // setTimeout/flush callback in autosave.ts, so a throw here would be an
    // unhandled rejection with no catcher.
    let body: { error?: string; violations?: Violation[] };
    try {
      body = (await res.json()) as { error?: string; violations?: Violation[] };
    } catch {
      return { kind: "error", message: "a 400 response was unreadable" };
    }
    if (body.error === "invalid") return { kind: "invalid", violations: body.violations ?? [] };
    return { kind: "error", message: body.error ?? "unexpected 400" };
  }
  return { kind: "offline" };
}
