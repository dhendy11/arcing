import { NextResponse } from "next/server";
import { deriveStatus } from "@/core/status";
import type { ArcDoc } from "@/core/types";
import { validateDoc } from "@/core/validate";
import { readArc, writeArc } from "@/server/arcStore";
import { badRequest, conflict, invalid, notFound, unauthorized } from "@/server/httpErrors";
import { hasValidSession } from "@/server/session";

interface Context {
  params: Promise<{ id: string }>;
}

export async function GET(req: Request, ctx: Context): Promise<Response> {
  if (!hasValidSession(req)) return unauthorized();
  const { id } = await ctx.params;
  const doc = await readArc(id);
  return doc ? NextResponse.json(doc) : notFound();
}

/**
 * validateDoc and deriveStatus are the core layer: they assume a shaped
 * ArcDoc and index straight into its arrays (propositions, arcs, arc.members,
 * summary.levels). A PUT body is untrusted JSON, not a typed ArcDoc, so a
 * body that is not an object, or is missing one of those arrays, would throw
 * out of validateDoc/deriveStatus as an unhandled 500 rather than the 400 an
 * invalid request should get. This checks only the shape those two functions
 * walk without checking, before the body is cast and handed to them; it is
 * not a restatement of validateDoc's semantic rules.
 */
function hasArcDocShape(value: unknown): value is ArcDoc {
  if (typeof value !== "object" || value === null) return false;
  const doc = value as Partial<ArcDoc>;
  if (typeof doc.id !== "string" || typeof doc.rev !== "number") return false;
  if (!Array.isArray(doc.propositions) || !Array.isArray(doc.arcs)) return false;
  if (typeof doc.summary !== "object" || doc.summary === null || !Array.isArray(doc.summary.levels)) return false;
  return doc.arcs.every((arc) => typeof arc === "object" && arc !== null && Array.isArray(arc.members));
}

export async function PUT(req: Request, ctx: Context): Promise<Response> {
  if (!hasValidSession(req)) return unauthorized();
  const { id } = await ctx.params;

  const stored = await readArc(id);
  if (!stored) return notFound();

  let body: ArcDoc;
  try {
    const parsed = (await req.json()) as unknown;
    if (!hasArcDocShape(parsed)) return badRequest("malformed arc document");
    body = parsed;
  } catch {
    return badRequest("unreadable body");
  }
  if (body.id !== id) return badRequest("id mismatch");

  const force = new URL(req.url).searchParams.get("force") === "1";
  if (body.rev !== stored.rev && !force) return conflict(stored);

  // status and rev are the server's to set, never the client's.
  const next: ArcDoc = {
    ...body,
    rev: stored.rev + 1,
    createdAt: stored.createdAt,
    updatedAt: new Date().toISOString(),
    status: deriveStatus(body),
  };

  const violations = validateDoc(next);
  if (violations.length > 0) return invalid(violations);

  await writeArc(next);
  return NextResponse.json(next);
}
