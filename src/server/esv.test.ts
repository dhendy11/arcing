import { expect, test } from "vitest";
import { ESV_PARAMS, EsvUnavailableError, fetchPassage, parsePassage } from "./esv";

/** The response shape documented at https://api.esv.org/docs/passage-text/ */
function apiResponse(canonical: string, passage: string): Response {
  return new Response(JSON.stringify({ canonical, passages: [passage] }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

test("the documented John 11:35 example parses to text with no marker", () => {
  const parsed = parsePassage("John 11:35", "[35] Jesus wept.\n\n");
  expect(parsed).toEqual({
    canonical: "John 11:35",
    text: "Jesus wept.",
    verses: [{ n: 35, start: 0 }],
  });
});

test("a two-verse passage records where each verse starts in the cleaned text", () => {
  const parsed = parsePassage(
    "Romans 12:1-2",
    "[1] I appeal to you therefore, brothers.\n\n    [2] Do not be conformed to this world.\n"
  );
  expect(parsed.text).toBe("I appeal to you therefore, brothers. Do not be conformed to this world.");
  expect(parsed.verses).toEqual([
    { n: 1, start: 0 },
    { n: 2, start: 37 },
  ]);
  expect(parsed.text.slice(37)).toBe("Do not be conformed to this world.");
});

test("the query parameters are the spec's, exactly", () => {
  expect(ESV_PARAMS).toEqual({
    "include-headings": "false",
    "include-footnotes": "false",
    "include-passage-references": "false",
    "include-short-copyright": "false",
    "include-verse-numbers": "true",
    "indent-paragraphs": "0",
    "indent-poetry": "false",
    "line-length": "0",
  });
});

test("the request carries the reference and the Token header", async () => {
  let seen: Request | null = null;
  const fetchImpl: typeof fetch = async (input, init) => {
    seen = new Request(input as RequestInfo, init);
    return apiResponse("John 11:35", "[35] Jesus wept.");
  };

  const passage = await fetchPassage("John 11:35", { fetchImpl, apiKey: "KEY" });

  expect(passage.text).toBe("Jesus wept.");
  const url = new URL(seen!.url);
  expect(url.origin + url.pathname).toBe("https://api.esv.org/v3/passage/text/");
  expect(url.searchParams.get("q")).toBe("John 11:35");
  expect(url.searchParams.get("include-verse-numbers")).toBe("true");
  expect(seen!.headers.get("authorization")).toBe("Token KEY");
});

test("a non-200 response is an ESV outage, not a crash", async () => {
  const fetchImpl: typeof fetch = async () => new Response("nope", { status: 401 });
  await expect(fetchPassage("John 11:35", { fetchImpl, apiKey: "KEY" })).rejects.toBeInstanceOf(EsvUnavailableError);
});

test("an empty passage list is an ESV outage", async () => {
  const fetchImpl: typeof fetch = async () =>
    new Response(JSON.stringify({ canonical: "", passages: [] }), { status: 200 });
  await expect(fetchPassage("Nowhere 1:1", { fetchImpl, apiKey: "KEY" })).rejects.toBeInstanceOf(EsvUnavailableError);
});

test("a thrown fetch is an ESV outage", async () => {
  const fetchImpl: typeof fetch = async () => {
    throw new Error("socket hang up");
  };
  await expect(fetchPassage("John 11:35", { fetchImpl, apiKey: "KEY" })).rejects.toBeInstanceOf(EsvUnavailableError);
});

test("a missing api key is an ESV outage rather than an unauthenticated call", async () => {
  await expect(fetchPassage("John 11:35", { apiKey: "" })).rejects.toBeInstanceOf(EsvUnavailableError);
});
