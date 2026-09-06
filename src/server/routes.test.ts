import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { POST as login } from "@/app/api/login/route";
import { POST as logout } from "@/app/api/logout/route";
import { GET as listArcs, POST as createArcRoute } from "@/app/api/arcs/route";
import { GET as getArc, PUT as putArc } from "@/app/api/arcs/[id]/route";
import type { ArcDoc } from "@/core/types";
import { SESSION_COOKIE, hashPassword, signSession } from "./session";

const SECRET = "routes-secret";
const envBefore = { ...process.env };
let dataDir: string;

function signedIn(url: string, init: RequestInit = {}): Request {
  const token = signSession(Date.now() + 60_000, SECRET);
  const headers = new Headers(init.headers);
  headers.set("cookie", `${SESSION_COOKIE}=${token}`);
  headers.set("content-type", "application/json");
  return new Request(url, { ...init, headers });
}

beforeEach(async () => {
  process.env = { ...envBefore };
  process.env.SESSION_SECRET = SECRET;
  process.env.APP_PASSWORD_HASH = hashPassword("hunter2");
  process.env.ESV_API_KEY = "KEY";
  dataDir = await mkdtemp(path.join(tmpdir(), "arcing-routes-"));
  process.env.DATA_DIR = dataDir;
});

afterEach(async () => {
  vi.unstubAllGlobals();
  process.env = { ...envBefore };
  await rm(dataDir, { recursive: true, force: true });
});

async function createPasted(reference = "Romans 12:1-2", text = "one two three"): Promise<ArcDoc> {
  const res = await createArcRoute(
    signedIn("https://x.test/api/arcs", { method: "POST", body: JSON.stringify({ reference, text }) })
  );
  expect(res.status).toBe(201);
  return (await res.json()) as ArcDoc;
}

// loginLimiter (server/rateLimit.ts) is a module-level singleton with no
// reset between tests, so the three login tests below each use a distinct
// x-forwarded-for value; reusing an IP would fail confusingly on whichever
// test ran second.
test("the right password sets the session cookie", async () => {
  const res = await login(
    new Request("https://x.test/api/login", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "1.1.1.1" },
      body: JSON.stringify({ password: "hunter2" }),
    })
  );
  expect(res.status).toBe(200);
  expect(res.headers.get("set-cookie")).toContain(`${SESSION_COOKIE}=`);
});

test("the wrong password is a 401 with no cookie", async () => {
  const res = await login(
    new Request("https://x.test/api/login", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "2.2.2.2" },
      body: JSON.stringify({ password: "wrong" }),
    })
  );
  expect(res.status).toBe(401);
  expect(res.headers.get("set-cookie")).toBeNull();
});

test("the sixth login attempt in a minute is a 429", async () => {
  const attempt = () =>
    login(
      new Request("https://x.test/api/login", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "3.3.3.3" },
        body: JSON.stringify({ password: "wrong" }),
      })
    );
  for (let i = 0; i < 5; i += 1) expect((await attempt()).status).toBe(401);
  expect((await attempt()).status).toBe(429);
});

test("logout clears the cookie", async () => {
  const res = await logout();
  expect(res.headers.get("set-cookie")).toContain("Max-Age=0");
});

test("the arcs list needs a session", async () => {
  expect((await listArcs(new Request("https://x.test/api/arcs"))).status).toBe(401);
  expect((await listArcs(signedIn("https://x.test/api/arcs"))).status).toBe(200);
});

test("posting text creates a pasted arc with one proposition", async () => {
  const doc = await createPasted();
  expect(doc.passage.source).toBe("paste");
  expect(doc.passage.text).toBe("one two three");
  expect(doc.propositions).toHaveLength(1);
  expect(doc.rev).toBe(1);
  expect(doc.id.endsWith("-romans-12-1-2")).toBe(true);
});

test("posting without text fetches from the ESV API", async () => {
  vi.stubGlobal("fetch", async () =>
    new Response(JSON.stringify({ canonical: "John 11:35", passages: ["[35] Jesus wept."] }), { status: 200 })
  );
  const res = await createArcRoute(
    signedIn("https://x.test/api/arcs", { method: "POST", body: JSON.stringify({ reference: "John 11:35" }) })
  );
  const doc = (await res.json()) as ArcDoc;
  expect(doc.passage.source).toBe("esv-api");
  expect(doc.passage.text).toBe("Jesus wept.");
  expect(doc.passage.verses).toEqual([{ n: 35, start: 0 }]);
});

test("an ESV failure is a 503 and writes no file", async () => {
  vi.stubGlobal("fetch", async () => new Response("nope", { status: 500 }));
  const res = await createArcRoute(
    signedIn("https://x.test/api/arcs", { method: "POST", body: JSON.stringify({ reference: "John 11:35" }) })
  );
  expect(res.status).toBe(503);
  expect(await res.json()).toEqual({ error: "esv_unavailable" });
  const list = await (await listArcs(signedIn("https://x.test/api/arcs"))).json();
  expect(list).toEqual({ arcs: [], unreadable: [] });
});

test("a second arc for the same reference on the same day takes the -2 suffix", async () => {
  const first = await createPasted();
  const second = await createPasted();
  expect(second.id).toBe(`${first.id}-2`);
});

test("an arc is fetched by id and an unknown id is a 404", async () => {
  const doc = await createPasted();
  const ok = await getArc(signedIn(`https://x.test/api/arcs/${doc.id}`), { params: Promise.resolve({ id: doc.id }) });
  expect(((await ok.json()) as ArcDoc).id).toBe(doc.id);

  const missing = await getArc(signedIn("https://x.test/api/arcs/nope"), { params: Promise.resolve({ id: "nope" }) });
  expect(missing.status).toBe(404);
});

test("a put at the loaded rev saves, bumps the rev and stamps updatedAt", async () => {
  const doc = await createPasted();
  const edited: ArcDoc = { ...doc, summary: { ...doc.summary, mainPoint: "Present your bodies." } };
  const beforePut = new Date().toISOString();
  const res = await putArc(
    signedIn(`https://x.test/api/arcs/${doc.id}`, { method: "PUT", body: JSON.stringify(edited) }),
    { params: Promise.resolve({ id: doc.id }) }
  );
  const saved = (await res.json()) as ArcDoc;
  expect(res.status).toBe(200);
  expect(saved.rev).toBe(doc.rev + 1);
  expect(saved.summary.mainPoint).toBe("Present your bodies.");
  // A strict > against doc.updatedAt flakes: the PUT can land in the same
  // millisecond as creation. beforePut is captured after creation and before
  // the PUT, so >= against it still proves the timestamp was written during
  // this PUT rather than carried over, without depending on sub-millisecond
  // distinctness.
  expect(saved.updatedAt >= beforePut).toBe(true);
});

test("a put at a stale rev is a 409 carrying the server copy", async () => {
  const doc = await createPasted();
  await putArc(signedIn(`https://x.test/api/arcs/${doc.id}`, { method: "PUT", body: JSON.stringify(doc) }), {
    params: Promise.resolve({ id: doc.id }),
  });

  const res = await putArc(
    signedIn(`https://x.test/api/arcs/${doc.id}`, { method: "PUT", body: JSON.stringify(doc) }),
    { params: Promise.resolve({ id: doc.id }) }
  );
  expect(res.status).toBe(409);
  const body = (await res.json()) as { error: string; doc: ArcDoc };
  expect(body.error).toBe("conflict");
  expect(body.doc.rev).toBe(2);
});

test("force overwrites a stale rev", async () => {
  const doc = await createPasted();
  await putArc(signedIn(`https://x.test/api/arcs/${doc.id}`, { method: "PUT", body: JSON.stringify(doc) }), {
    params: Promise.resolve({ id: doc.id }),
  });
  const res = await putArc(
    signedIn(`https://x.test/api/arcs/${doc.id}?force=1`, { method: "PUT", body: JSON.stringify(doc) }),
    { params: Promise.resolve({ id: doc.id }) }
  );
  expect(res.status).toBe(200);
  expect(((await res.json()) as ArcDoc).rev).toBe(3);
});

test("a put carrying a violation is refused and nothing is written", async () => {
  const doc = await createPasted();
  const broken: ArcDoc = { ...doc, propositions: [{ id: "p1", start: 0, end: 2, text: "on" }] };
  const res = await putArc(
    signedIn(`https://x.test/api/arcs/${doc.id}`, { method: "PUT", body: JSON.stringify(broken) }),
    { params: Promise.resolve({ id: doc.id }) }
  );
  expect(res.status).toBe(400);
  const body = (await res.json()) as { error: string; violations: { code: string }[] };
  expect(body.error).toBe("invalid");
  expect(body.violations.length).toBeGreaterThan(0);

  const stored = await getArc(signedIn(`https://x.test/api/arcs/${doc.id}`), { params: Promise.resolve({ id: doc.id }) });
  expect(((await stored.json()) as ArcDoc).rev).toBe(1);
});

test("the server derives status rather than trusting the body", async () => {
  const doc = await createPasted();
  const lying: ArcDoc = { ...doc, status: "complete", markedComplete: false };
  const res = await putArc(
    signedIn(`https://x.test/api/arcs/${doc.id}`, { method: "PUT", body: JSON.stringify(lying) }),
    { params: Promise.resolve({ id: doc.id }) }
  );
  expect(res.status).toBe(200);
  expect(((await res.json()) as ArcDoc).status).toBe("split");
});

// The following three tests are not in the brief. validateDoc and
// deriveStatus assume a shaped ArcDoc and throw on a body that is not one
// (null, or missing the arrays they iterate), which without a guard would
// surface as an unhandled 500 instead of a 400. See task-11-report.md for
// the reasoning.

test("a PUT body that is not an object is a 400, not a 500", async () => {
  const doc = await createPasted();
  const res = await putArc(
    signedIn(`https://x.test/api/arcs/${doc.id}`, { method: "PUT", body: JSON.stringify(null) }),
    { params: Promise.resolve({ id: doc.id }) }
  );
  expect(res.status).toBe(400);
});

test("a PUT body missing propositions entirely is a 400, not a 500", async () => {
  const doc = await createPasted();
  const res = await putArc(
    signedIn(`https://x.test/api/arcs/${doc.id}`, { method: "PUT", body: JSON.stringify({ id: doc.id, rev: 1 }) }),
    { params: Promise.resolve({ id: doc.id }) }
  );
  expect(res.status).toBe(400);
});

test("a PUT body with an arc missing its members array is a 400, not a 500", async () => {
  const doc = await createPasted();
  const broken = { ...doc, arcs: [{ id: "a1", kind: "arc", rel: "AcAc", circled: null }] };
  const res = await putArc(
    signedIn(`https://x.test/api/arcs/${doc.id}`, { method: "PUT", body: JSON.stringify(broken) }),
    { params: Promise.resolve({ id: doc.id }) }
  );
  expect(res.status).toBe(400);
});

test("a PUT body missing passage entirely is a 400, not a 500", async () => {
  const doc = await createPasted();
  const broken = { ...doc, passage: undefined };
  const res = await putArc(
    signedIn(`https://x.test/api/arcs/${doc.id}`, { method: "PUT", body: JSON.stringify(broken) }),
    { params: Promise.resolve({ id: doc.id }) }
  );
  expect(res.status).toBe(400);
});

test("a PUT body with passage.text missing on a doc with a proposition is a 400, not a 500", async () => {
  const doc = await createPasted();
  const broken = { ...doc, passage: { ...doc.passage, text: undefined } };
  const res = await putArc(
    signedIn(`https://x.test/api/arcs/${doc.id}`, { method: "PUT", body: JSON.stringify(broken) }),
    { params: Promise.resolve({ id: doc.id }) }
  );
  expect(res.status).toBe(400);
});

test("a PUT body marked complete with summary.mainPoint missing is a 400, not a 500", async () => {
  const doc = await createPasted();
  const broken = { ...doc, markedComplete: true, summary: { ...doc.summary, mainPoint: undefined } };
  const res = await putArc(
    signedIn(`https://x.test/api/arcs/${doc.id}`, { method: "PUT", body: JSON.stringify(broken) }),
    { params: Promise.resolve({ id: doc.id }) }
  );
  expect(res.status).toBe(400);
});

test("an oversized reference on POST is a 400, not a 500", async () => {
  const res = await createArcRoute(
    signedIn("https://x.test/api/arcs", {
      method: "POST",
      body: JSON.stringify({ reference: `Romans ${"a".repeat(70)}`, text: "one two three" }),
    })
  );
  expect(res.status).toBe(400);
  const list = await (await listArcs(signedIn("https://x.test/api/arcs"))).json();
  expect(list).toEqual({ arcs: [], unreadable: [] });
});

test("the reported 68-character-slug collision no longer 500s on the second post", async () => {
  // At MAX_REFERENCE_SLUG_LENGTH's old value of 69, a 68-character slug
  // passed the early check on the first post, then crashed writeArc on the
  // second post's "-2" suffix (the id passed 80 characters). At the current
  // bound of 66, 68 is rejected by the early check on its own, on EVERY
  // post, so this never reaches writeArc at all; that is the fix. Posting
  // twice pins the regression: neither attempt may 500 or write a file.
  const post = () =>
    createArcRoute(
      signedIn("https://x.test/api/arcs", {
        method: "POST",
        body: JSON.stringify({ reference: "a".repeat(68), text: "one two three" }),
      })
    );
  const first = await post();
  expect(first.status).toBe(400);
  const second = await post();
  expect(second.status).toBe(400);
  const list = await (await listArcs(signedIn("https://x.test/api/arcs"))).json();
  expect(list).toEqual({ arcs: [], unreadable: [] });
});
