import { normalizeText } from "@/core/doc";
import type { Verse } from "@/core/types";

/**
 * Server side only, reached solely through POST /api/arcs, so the key never
 * reaches the browser. Verified 2026-09-05 at https://api.esv.org/ and
 * /docs/passage-text/: the response carries "canonical" and "passages", and
 * verse numbers come back inline as [35].
 */
const ESV_ENDPOINT = "https://api.esv.org/v3/passage/text/";

export const ESV_PARAMS: Record<string, string> = {
  "include-headings": "false",
  "include-footnotes": "false",
  "include-passage-references": "false",
  "include-short-copyright": "false",
  "include-verse-numbers": "true",
  "indent-paragraphs": "0",
  "indent-poetry": "false",
  "line-length": "0",
};

export class EsvUnavailableError extends Error {
  constructor(cause: string) {
    super(`esv_unavailable: ${cause}`);
    this.name = "EsvUnavailableError";
  }
}

export interface EsvPassage {
  canonical: string;
  text: string;
  verses: Verse[];
}

/**
 * Strip the inline [n] markers and record where each verse begins in the
 * cleaned text. The whitespace collapse is normalizeText itself (src/core/doc.ts),
 * not a re-implementation of it, so the offsets recorded here index into the
 * exact same normalised string newArcDoc stores. That cleaned text is the
 * only copy this app keeps, so this is the one place the indices come from.
 */
export function parsePassage(canonical: string, raw: string): EsvPassage {
  const collapsed = normalizeText(raw);
  const marker = /\[(\d+)\]\s*/y;
  const verses: Verse[] = [];
  let text = "";
  let i = 0;

  while (i < collapsed.length) {
    marker.lastIndex = i;
    const match = marker.exec(collapsed);
    if (match) {
      verses.push({ n: Number(match[1]), start: text.length });
      i = marker.lastIndex;
      continue;
    }
    text += collapsed[i];
    i += 1;
  }

  return { canonical, text: normalizeText(text), verses };
}

export interface FetchPassageOptions {
  fetchImpl?: typeof fetch;
  apiKey?: string;
  timeoutMs?: number;
}

export async function fetchPassage(reference: string, opts: FetchPassageOptions = {}): Promise<EsvPassage> {
  const apiKey = opts.apiKey ?? process.env.ESV_API_KEY ?? "";
  if (!apiKey) throw new EsvUnavailableError("no api key");

  const url = new URL(ESV_ENDPOINT);
  url.searchParams.set("q", reference);
  for (const [k, v] of Object.entries(ESV_PARAMS)) url.searchParams.set(k, v);

  const doFetch = opts.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await doFetch(url, {
      headers: { Authorization: `Token ${apiKey}` },
      signal: AbortSignal.timeout(opts.timeoutMs ?? 8000),
    });
  } catch (error) {
    throw new EsvUnavailableError(error instanceof Error ? error.message : "fetch failed");
  }

  if (!response.ok) throw new EsvUnavailableError(`status ${response.status}`);

  let body: { canonical?: string; passages?: string[] };
  try {
    body = (await response.json()) as { canonical?: string; passages?: string[] };
  } catch {
    throw new EsvUnavailableError("unreadable body");
  }

  const passage = body.passages?.[0];
  if (!passage || !passage.trim()) throw new EsvUnavailableError("no passage returned");

  return parsePassage(body.canonical ?? reference, passage);
}
