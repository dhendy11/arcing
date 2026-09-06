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
 * ArcDoc and dereference several of its fields without checking them first.
 * This guard covers the top-level shape (propositions and arcs as arrays,
 * each arc's members as an array, passage.text and summary.mainPoint as
 * strings) so a body that is not an object, or missing one of those, is a
 * 400 rather than an unhandled 500. It is not a restatement of validateDoc's
 * semantic rules, and it is not exhaustive: a summary.levels entry missing
 * `text` (read by completionMissing) and a null or malformed element inside
 * an otherwise-array arcs[i].members (read by structuralViolations) are
 * known gaps, left alone deliberately rather than growing this into a
 * second copy of validateDoc's own checks.
 */
function hasArcDocShape(value: unknown): value is ArcDoc {
  if (typeof value !== "object" || value === null) return false;
  const doc = value as Partial<ArcDoc>;
  if (typeof doc.id !== "string" || typeof doc.rev !== "number") return false;
  if (!Array.isArray(doc.propositions) || !Array.isArray(doc.arcs)) return false;
  if (typeof doc.passage !== "object" || doc.passage === null || typeof doc.passage.text !== "string") return false;
  if (typeof doc.summary !== "object" || doc.summary === null || !Array.isArray(doc.summary.levels)) return false;
  if (typeof doc.summary.mainPoint !== "string") return false;
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
