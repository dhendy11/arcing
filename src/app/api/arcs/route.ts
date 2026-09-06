import { NextResponse } from "next/server";
import { arcId, localDate, newArcDoc, referenceSlug } from "@/core/doc";
import { validateDoc } from "@/core/validate";
import { listArcIds, listSummaries, writeArc } from "@/server/arcStore";
import { EsvUnavailableError, fetchPassage } from "@/server/esv";
import { badRequest, invalid, serviceUnavailable, unauthorized } from "@/server/httpErrors";
import { hasValidSession } from "@/server/session";

/** The box runs America/New_York; a Saturday-night arc is filed on Saturday. */
const ARC_TIMEZONE = "America/New_York";

/**
 * isSafeArcId (server/arcStore.ts) caps an arc id at 80 characters. The date
 * prefix arcId prepends is 11 of those (YYYY-MM-DD plus the joining hyphen).
 * arcId can also append a same-day collision suffix ("-2", "-3", ...) with no
 * fixed upper bound, so no static slug length can guarantee safety on its
 * own; this only rejects the common case early, before any ESV fetch or
 * write. 66 leaves headroom for the date prefix plus an ordinary collision
 * suffix; the write below is still guarded in case a pathological same-day
 * collision count gets past this anyway.
 */
const MAX_REFERENCE_SLUG_LENGTH = 66;

/**
 * The body is an object rather than the bare array it used to be. An arc
 * file that cannot be read is skipped from the list, and with no delete
 * affordance anywhere in this app a silent skip reads as an arc that
 * vanished, so the skipped ids travel with the rows and the series page
 * prints how many there were.
 */
export async function GET(req: Request): Promise<Response> {
  if (!hasValidSession(req)) return unauthorized();
  const { summaries, skipped } = await listSummaries();
  return NextResponse.json({ arcs: summaries, unreadable: skipped });
}

export async function POST(req: Request): Promise<Response> {
  if (!hasValidSession(req)) return unauthorized();

  let reference = "";
  let pasted: string | undefined;
  try {
    const body = (await req.json()) as { reference?: unknown; text?: unknown };
    reference = typeof body.reference === "string" ? body.reference.trim() : "";
    pasted = typeof body.text === "string" ? body.text : undefined;
  } catch {
    return badRequest("unreadable body");
  }
  if (!reference) return badRequest("a reference is required");
  if (referenceSlug(reference).length > MAX_REFERENCE_SLUG_LENGTH) return badRequest("reference is too long");

  let canonical = reference;
  let text: string;
  let verses: { n: number; start: number }[] = [];
  let source: "paste" | "esv-api";

  if (pasted !== undefined) {
    if (!pasted.trim()) return badRequest("pasted text is empty");
    source = "paste";
    text = pasted;
  } else {
    try {
      const passage = await fetchPassage(reference);
      canonical = passage.canonical;
      text = passage.text;
      verses = passage.verses;
      source = "esv-api";
    } catch (error) {
      if (error instanceof EsvUnavailableError) return serviceUnavailable("esv_unavailable");
      throw error;
    }
  }

  const now = new Date();
  const doc = newArcDoc({
    id: arcId(localDate(now, ARC_TIMEZONE), reference, await listArcIds()),
    reference,
    canonical,
    source,
    text,
    verses,
    now,
  });

  const violations = validateDoc(doc);
  if (violations.length > 0) return invalid(violations);

  try {
    await writeArc(doc);
  } catch (error) {
    // Belt and braces: the length check above rejects the common case, but a
    // same-day collision suffix has no fixed upper bound, so isSafeArcId can
    // still refuse doc.id here. Anything else is a real failure and must
    // still surface as a 500 (the visibility Task 10's review restored).
    if (error instanceof Error && error.message.startsWith("unsafe arc id")) {
      return badRequest("reference is too long");
    }
    throw error;
  }
  return NextResponse.json(doc, { status: 201 });
}
