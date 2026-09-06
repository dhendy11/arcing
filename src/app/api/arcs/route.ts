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
 * prefix arcId prepends is 11 of those (YYYY-MM-DD plus the joining hyphen),
 * leaving 69 for the reference's slug. Reject an oversized reference here,
 * before any ESV fetch or write, rather than letting writeArc fail later on
 * an id isSafeArcId refuses.
 */
const MAX_REFERENCE_SLUG_LENGTH = 69;

export async function GET(req: Request): Promise<Response> {
  if (!hasValidSession(req)) return unauthorized();
  return NextResponse.json(await listSummaries());
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

  await writeArc(doc);
  return NextResponse.json(doc, { status: 201 });
}
