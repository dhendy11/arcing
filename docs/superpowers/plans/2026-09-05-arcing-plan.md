# arcing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the single-user Bible arcing tool: split a passage into propositions, relate them with Piper's 18 relationships until one arc spans the passage, write the summary, every arc a dated JSON file on Drew's own box.

**Architecture:** A pure TypeScript core (`src/core/`) owns every rule (relationships, document validation, proposition tiling, arc tree, layout geometry) with no React, no Next and no IO, so all of it is unit tested first. A thin server layer (`src/server/`) adds the password cookie, the ESV fetch and the JSON file store, exposed as Next.js Route Handlers. The screens are client components that call those routes and drive a zustand store with zundo undo. One `layout(doc, mode)` function produces all geometry; one component draws the SVG.

**Tech Stack:** Next.js 16.3.3 standalone, React 19.2.8, TypeScript 5, zustand 5.0.15 + zundo 2.3.0, inline SVG, vitest 4 + Testing Library + Playwright 1.62.1, Node 22, no database.

**Spec:** `docs/superpowers/specs/2026-09-05-arcing-design.md`, which travels beside this plan (in the EA repo at `projects/bible-arcing-app/2026-09-05-design.md`, copied into this repo at `docs/superpowers/plans/2026-09-05-design.md` at kick-off). The rulings behind it are in `one-pager.md`. Read both before Task 1. The plan argues from the spec; where they disagree, the spec wins and the disagreement is listed under "Decisions this plan had to make" at the bottom.

## Global Constraints

Copied from the spec. Every task's requirements implicitly include this section.

- **Stack, fixed:** Next.js 16 standalone (`output: "standalone"`), React 19, TypeScript, zustand 5 + zundo 2, inline SVG, vitest + Testing Library + Playwright. No database, no Auth.js, no PGlite.
- **Gate:** `npm run gate` = `tsc --noEmit && eslint . && vitest run`. `npm run e2e` is separate and never runs inside the gate. Playwright `retries: 0`.
- **Touch targets 44 px minimum.** Every target works with a mouse, so "tap" means tap or click.
- **Base type 17 px.**
- **Colour, one reading, no substitutions (Kole Jain):** paper `#faf8f5`, ink `#1c1917`, accent `#1d4ed8` on selection and active state, `#b91c1c` only on destructive controls. Sans chrome, serif passage text.
- **The ESV notice, verbatim, beneath any view showing passage text, with "ESV" linked to https://www.esv.org:** `Scripture quotations are from the ESV® Bible (The Holy Bible, English Standard Version®), © 2001 by Crossway, a publishing ministry of Good News Publishers. Used by permission. All rights reserved.`
- **No emojis and no em dashes** in any copy, any code comment, any commit message, any test name.
- **The tool never writes to the EA repo.** No route, no script, no exception.
- **Out of scope, binding:** Greek and Hebrew tags, bracketing, phrasing, sharing, multi-user accounts, phone layout (iPad Safari at 1024 px is in), Biblearc import, the four optional relationships (Both-And, General-Specific, Fact-Interpretation, Anticipation-Fulfillment), AI, other translations, PDF export, keyboard-first editing, deleting an arc (no affordance, no route), any write from the tool into the EA repo.
- **Fixtures never use a passage Drew arcs himself.** Ephesians is his own series and is banned from every fixture and every test. Piper's published Romans 12:1-2 arc is the only sanctioned sample.
- **`arcing` is a literal placeholder** for the repo name, the hostname, the systemd service and the deploy paths. Write it literally everywhere so one find-and-replace at kick-off resolves it. It is NOT part of the environment variable names: `APP_PASSWORD_HASH`, `APP_E2E_AUTH`, `SESSION_SECRET`, `ESV_API_KEY` and `DATA_DIR` are literal names from the spec and stay exactly as written.
- **Port 3006.** 3001-3003, 3004 (banso) and 3005 (madori) are taken.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/core/tokens.ts` | Colour, type and copy constants, including the ESV notice |
| `src/core/relationships.ts` | The 18 relationships: code, name, symbol, group, definition, member counts, circle rule |
| `src/core/types.ts` | Every document type plus `SCHEMA_VERSION` |
| `src/core/doc.ts` | Reference slug, arc id and collision suffix, local date, `newArcDoc` |
| `src/core/tree.ts` | Pure queries over the arc forest: top-level units, spans, nesting level, rootedness |
| `src/core/status.ts` | `completionMissing` and the derived `status` |
| `src/core/validate.ts` | `validateDoc`, the one authority on a legal document |
| `src/core/split.ts` | Split and rejoin, word-start rule, renumbering, dissolve sets |
| `src/core/arcTree.ts` | Create, relabel, dissolve an arc, set the circled member, fit checks |
| `src/core/layout.ts` | `layout(doc, mode)` producing all geometry for the `stacked` mode |
| `src/server/session.ts` | scrypt password hash and compare, HMAC session cookie, e2e password bypass |
| `src/server/rateLimit.ts` | Per-IP login limiter |
| `src/server/esv.ts` | ESV API client and the inline verse-marker parser |
| `src/server/arcStore.ts` | `DATA_DIR` JSON file store, atomic write, listing |
| `src/server/httpErrors.ts` | Shared JSON error responses (harvested from madori) |
| `src/proxy.ts` | Route protection (harvested from madori, cookie instead of Auth.js) |
| `src/app/api/**` | Route handlers |
| `src/client/api.ts` | Typed fetch wrappers and the `SaveResult` union |
| `src/client/store.ts` | zustand store plus zundo temporal history |
| `src/client/autosave.ts` | Debounce, throttle, flush, mirror, conflict, offline backoff |
| `src/components/*.tsx` | Every screen's view component. Pages under `src/app` are thin wrappers |
| `src/fixtures/piperRomans.ts` | Piper's Romans 12:1-2 arc, the only sanctioned sample |
| `e2e/arc.spec.ts` | The one Playwright flow, two projects |
| `deploy/` | systemd unit, Caddy block, backup additions |
| `KICKOFF.md` | The human steps, each a command where possible |

## Conventions every task follows

- Tests sit beside the file they test: `src/core/split.ts` is tested by `src/core/split.test.ts`.
- Node-environment tests are the default. A component test file starts with the docblock `// @vitest-environment jsdom` on its first line.
- `src/core/**` imports nothing from React, Next, Node built-ins, or outward layers. ESLint enforces this (Task 1).
- Core operations are pure: they take a document and return a new document. They never mutate their argument.
- Every commit message is one line, conventional-commit prefixed, with no emoji and no em dash.
- Run the targeted test for the task you are on. Run the full `npm run gate` once at the end of your task, and `npm run e2e` only in Task 21 and after.

---

### Task 1: Repo scaffold, the gate, and the design tokens

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `vitest.config.mts`, `.gitignore`, `.env.example`, `README.md`, `src/test/setup.ts`, `src/app/layout.tsx`, `src/app/globals.css`, `src/core/tokens.ts` (`playwright.config.ts` arrives with the flow it configures, in Task 21)
- Test: `src/core/tokens.test.ts`

**Interfaces:**
- Consumes: nothing. This task starts from an empty directory.
- Produces: `npm run gate` and `npm run e2e` scripts; the `@/*` path alias to `src/*`; `COLORS`, `BASE_FONT_PX`, `MIN_TARGET_PX`, `FONT_SANS`, `FONT_SERIF`, `ESV_NOTICE`, `ESV_URL`, `AMBER` from `src/core/tokens.ts`.

- [ ] **Step 1: Initialise the repository and write `package.json`**

```bash
git init
```

`package.json` (versions harvested from `~/Documents/Programming/madori/package.json`, minus what this app does not use: no pg, no next-auth, no nodemailer, no jspdf):

```json
{
  "name": "arcing",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "gate": "tsc --noEmit && eslint . && vitest run",
    "e2e": "playwright test",
    "hash-password": "tsx scripts/hashPassword.ts"
  },
  "dependencies": {
    "next": "16.3.3",
    "react": "19.2.8",
    "react-dom": "19.2.8",
    "zundo": "2.3.0",
    "zustand": "5.0.15"
  },
  "devDependencies": {
    "@playwright/test": "1.62.1",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "@vitejs/plugin-react": "^6.1.0",
    "eslint": "^9",
    "eslint-config-next": "16.3.3",
    "fast-check": "^4.9.0",
    "tsx": "^4.23.12",
    "typescript": "^5",
    "vitest": "^4.1.11"
  }
}
```

- [ ] **Step 2: Install, including the four test libraries by name**

```bash
npm install
npm install --save-dev @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom
npx playwright install chromium webkit
```

Expected: no peer-dependency errors. If `@testing-library/react` refuses React 19, install the latest major that accepts it and record the resolved version in `README.md`.

- [ ] **Step 3: Write the config files**

`tsconfig.json` (madori's, verbatim):

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts",
    ".next/dev/types/**/*.ts",
    "**/*.mts"
  ],
  "exclude": ["node_modules"]
}
```

`next.config.ts` (madori's, stripped of its PGlite comments and keys, which do not apply here):

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // File tracing pulls e2e and deploy material into .next/standalone that
  // the running server never touches. Same reasoning as madori's
  // next.config.ts: these are cwd-relative noise, not imports.
  outputFileTracingExcludes: {
    "*": ["e2e/**", "deploy/**"],
  },
};

export default nextConfig;
```

`eslint.config.mjs` (madori's, with the core-purity rule retargeted at this app's layers):

```js
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
  {
    files: ["src/core/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["react", "react-dom", "react/*", "react-dom/*", "next", "next/*"], message: "src/core is pure TS: no React, no Next." },
            { group: ["node:*", "fs", "fs/*", "path", "os", "child_process", "http", "https", "crypto", "util", "url", "stream", "stream/*", "events", "buffer", "process"], message: "src/core does no IO." },
            { group: ["**/server/*", "**/client/*", "**/components/*", "**/app/*", "@/server/*", "@/client/*", "@/components/*", "@/app/*"], message: "src/core does not import outward." },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
```

`vitest.config.mts` (madori's, plus the setup file and the tsx include):

```ts
import path from "node:path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Mirror tsconfig's "@/*" -> "src/*"; vitest does not read tsconfig paths.
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  test: {
    // Node is the default. Component test files opt into a DOM with the
    // first-line docblock "// @vitest-environment jsdom".
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["src/test/setup.ts"],
  },
});
```

`src/test/setup.ts`:

```ts
import { afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";

// Testing Library is only loaded when a DOM exists, so node-environment
// tests never pull react-dom in through this file.
afterEach(async () => {
  if (typeof document === "undefined") return;
  const { cleanup } = await import("@testing-library/react");
  cleanup();
});
```

`.gitignore`:

```
node_modules
.next
.env
.env.local
data
test-results
playwright-report
tsconfig.tsbuildinfo
next-env.d.ts
```

- [ ] **Step 4: Write the app shell so `next build` has something to build**

`src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "arcing" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

`src/app/globals.css` (the spec's palette and type, nothing else):

```css
:root {
  --paper: #faf8f5;
  --ink: #1c1917;
  --accent: #1d4ed8;
  --destructive: #b91c1c;
  --amber: #b45309;
  --sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
  --serif: Georgia, "Times New Roman", serif;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  background: var(--paper);
  color: var(--ink);
  font-family: var(--sans);
  font-size: 17px;
  line-height: 1.5;
  -webkit-text-size-adjust: 100%;
}

button, a, input, textarea, select { font: inherit; }

/* Every interactive target clears the 44 px floor. */
button, .target { min-height: 44px; min-width: 44px; }

.passage { font-family: var(--serif); }
```

- [ ] **Step 5: Write the failing test for the tokens**

`src/core/tokens.test.ts`:

```ts
import { expect, test } from "vitest";
import { BASE_FONT_PX, COLORS, ESV_NOTICE, ESV_URL, MIN_TARGET_PX } from "./tokens";

test("colour tokens are the spec's four values", () => {
  expect(COLORS).toEqual({
    paper: "#faf8f5",
    ink: "#1c1917",
    accent: "#1d4ed8",
    destructive: "#b91c1c",
  });
});

test("base type is 17 px and the touch floor is 44 px", () => {
  expect(BASE_FONT_PX).toBe(17);
  expect(MIN_TARGET_PX).toBe(44);
});

test("the ESV notice is the licence text verbatim", () => {
  expect(ESV_NOTICE).toBe(
    "Scripture quotations are from the ESV® Bible (The Holy Bible, English Standard Version®), © 2001 by Crossway, a publishing ministry of Good News Publishers. Used by permission. All rights reserved."
  );
  expect(ESV_URL).toBe("https://www.esv.org");
});
```

- [ ] **Step 6: Run it and watch it fail**

Run: `npx vitest run src/core/tokens.test.ts`
Expected: FAIL, "Failed to resolve import ./tokens".

- [ ] **Step 7: Write `src/core/tokens.ts`**

```ts
// Copy, colour and type constants pinned by the spec. Values here are the
// single source; globals.css repeats them as CSS variables because CSS
// cannot import TypeScript, and tokens.test.ts is what keeps them honest.
export const COLORS = {
  paper: "#faf8f5",
  ink: "#1c1917",
  accent: "#1d4ed8",
  destructive: "#b91c1c",
} as const;

// The spec asks for an amber ring on a missing circle but names no hex.
// This is the one added value; see the plan's decisions list.
export const AMBER = "#b45309";

export const BASE_FONT_PX = 17;
export const MIN_TARGET_PX = 44;

export const FONT_SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif';
export const FONT_SERIF = 'Georgia, "Times New Roman", serif';

// Crossway's licence condition, quoted exactly. Do not reword, do not wrap
// it in extra punctuation, do not shorten it.
export const ESV_NOTICE =
  "Scripture quotations are from the ESV® Bible (The Holy Bible, English Standard Version®), © 2001 by Crossway, a publishing ministry of Good News Publishers. Used by permission. All rights reserved.";

export const ESV_URL = "https://www.esv.org";
```

- [ ] **Step 8: Run the test and the gate**

Run: `npx vitest run src/core/tokens.test.ts && npm run gate && npm run build`
Expected: 3 tests pass, tsc clean, eslint clean, `next build` writes `.next/standalone`.

- [ ] **Step 9: Write `README.md` and `.env.example`**

`.env.example`:

```
# scrypt hash of the login password. Generate with: npm run hash-password
APP_PASSWORD_HASH=

# HMAC key for the app_session cookie. Generate with: openssl rand -base64 32
SESSION_SECRET=

# ESV API key, created at https://api.esv.org/account/create-application/
ESV_API_KEY=

# Where the arc JSON files live. The box uses /srv/deploy/arcing/data
DATA_DIR=./data

# Dev-only Playwright password bypass (src/server/session.ts). Only takes
# effect when NODE_ENV is also "development". Never set this in production.
APP_E2E_AUTH=
```

`README.md`: one paragraph on what the tool is, the four commands (`npm run dev`, `npm run gate`, `npm run e2e`, `npm run hash-password`), where the spec and this plan live (`docs/superpowers/plans/`), and the deploy pointer (`deploy/`, `KICKOFF.md`).

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next 16 app, gate, and design tokens"
```

---

### Task 2: The 18 relationships

**Files:**
- Create: `src/core/relationships.ts`
- Test: `src/core/relationships.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type RelCode = "S" | "P" | "A" | "AcMn" | "Cf" | "NegPos" | "IdExp" | "QA" | "G" | "Inf" | "BL" | "AcRes" | "AcPur" | "IfTh" | "T" | "L" | "Csv" | "SitR"`
  - `type RelGroup = "coordinate" | "restatement" | "distinct" | "contrary"`
  - `interface Relationship { code: RelCode; name: string; symbol: string; group: RelGroup; definition: string; minMembers: number; maxMembers: number | null; requiresCircle: boolean; warning?: string }`
  - `const RELATIONSHIPS: readonly Relationship[]` (18 entries, in the spec's order)
  - `const GROUP_ORDER: readonly RelGroup[]`, `const GROUP_HEADINGS: Record<RelGroup, string>`
  - `function relationship(code: RelCode): Relationship`
  - `const CIRCLING_CODES: readonly RelCode[]` (`AcPur`, `AcRes`, `SitR`)
  - `const NEG_POS_SYMBOL: string`

- [ ] **Step 1: Write the failing test**

`src/core/relationships.test.ts`:

```ts
import { expect, test } from "vitest";
import {
  CIRCLING_CODES,
  GROUP_ORDER,
  RELATIONSHIPS,
  relationship,
  type RelGroup,
} from "./relationships";

test("there are exactly 18 relationships", () => {
  expect(RELATIONSHIPS).toHaveLength(18);
});

test("the four headings appear in Piper's order", () => {
  expect(GROUP_ORDER).toEqual(["coordinate", "restatement", "distinct", "contrary"]);
});

test("each group holds the counts Piper's chart holds", () => {
  const count = (g: RelGroup) => RELATIONSHIPS.filter((r) => r.group === g).length;
  expect(count("coordinate")).toBe(3);
  expect(count("restatement")).toBe(5);
  expect(count("distinct")).toBe(8);
  expect(count("contrary")).toBe(2);
});

test("definitions are the cheat sheet's wording verbatim", () => {
  expect(relationship("S").definition).toBe(
    "Each proposition makes its own independent contribution to a whole."
  );
  expect(relationship("AcPur").definition).toBe("An action and its intended result.");
  expect(relationship("SitR").definition).toBe(
    "A situation and its surprising or counter-intuitive response."
  );
});

test("coordinate relationships take two or more members, the rest take two", () => {
  for (const code of ["S", "P", "A"] as const) {
    expect(relationship(code).minMembers).toBe(2);
    expect(relationship(code).maxMembers).toBeNull();
  }
  expect(relationship("G").minMembers).toBe(2);
  expect(relationship("G").maxMembers).toBe(2);
});

test("Bilateral takes exactly three members", () => {
  expect(relationship("BL").minMembers).toBe(3);
  expect(relationship("BL").maxMembers).toBe(3);
});

test("only Ac-Pur, Ac-Res and Sit-R require a circled member", () => {
  expect([...CIRCLING_CODES].sort()).toEqual(["AcPur", "AcRes", "SitR"]);
  const requiring = RELATIONSHIPS.filter((r) => r.requiresCircle).map((r) => r.code).sort();
  expect(requiring).toEqual(["AcPur", "AcRes", "SitR"]);
});

test("Ground and Inference carry Piper's page 34 warning", () => {
  const warning =
    "Piper, p. 34: do not mix these two up. In Ground the conclusion comes first; in Inference it comes second.";
  expect(relationship("G").warning).toBe(warning);
  expect(relationship("Inf").warning).toBe(warning);
  expect(RELATIONSHIPS.filter((r) => r.warning).map((r) => r.code)).toEqual(["G", "Inf"]);
});

test("codes are unique and relationship() throws on an unknown code", () => {
  expect(new Set(RELATIONSHIPS.map((r) => r.code)).size).toBe(18);
  // @ts-expect-error deliberately outside RelCode
  expect(() => relationship("XX")).toThrow(/unknown relationship/);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/core/relationships.test.ts`
Expected: FAIL, "Failed to resolve import ./relationships".

- [ ] **Step 3: Write `src/core/relationships.ts`**

```ts
// Piper's 18 logical relationships (booklet pp. 12-19, chart pp. 33-34).
// Names, symbols and group order follow Piper's chart; the one-line
// definitions are quoted verbatim from Biblearc's cheat sheet as recorded
// in references/personal/bible-arcing-primer.md section (b). Do not reword
// a definition: relationships.test.ts pins three of them and the whole
// point of this screen is that Drew compares candidates rather than
// recalling a name.
export type RelGroup = "coordinate" | "restatement" | "distinct" | "contrary";

export type RelCode =
  | "S" | "P" | "A"
  | "AcMn" | "Cf" | "NegPos" | "IdExp" | "QA"
  | "G" | "Inf" | "BL" | "AcRes" | "AcPur" | "IfTh" | "T" | "L"
  | "Csv" | "SitR";

export interface Relationship {
  code: RelCode;
  name: string;
  /** What is drawn on the arc. */
  symbol: string;
  group: RelGroup;
  definition: string;
  minMembers: number;
  /** null means unbounded above (the three coordinate relationships). */
  maxMembers: number | null;
  requiresCircle: boolean;
  warning?: string;
}

export const GROUP_ORDER: readonly RelGroup[] = ["coordinate", "restatement", "distinct", "contrary"];

export const GROUP_HEADINGS: Record<RelGroup, string> = {
  coordinate: "Coordinate",
  restatement: "Support by restatement",
  distinct: "Support by distinct statement",
  contrary: "Support by contrary statement",
};

/**
 * Piper draws Negative-Positive as a stroke rather than lettering, so the
 * renderer special cases this value. Written as an escape so the source file
 * stays ASCII: U+2212 MINUS SIGN, which is what the mockup's &minus; is.
 */
export const NEG_POS_SYMBOL = "\u2212/+";

const GROUND_INFERENCE_WARNING =
  "Piper, p. 34: do not mix these two up. In Ground the conclusion comes first; in Inference it comes second.";

const pair = { minMembers: 2, maxMembers: 2, requiresCircle: false } as const;
const openCoordinate = { minMembers: 2, maxMembers: null, requiresCircle: false } as const;

export const RELATIONSHIPS: readonly Relationship[] = [
  { code: "S", name: "Series", symbol: "S", group: "coordinate", ...openCoordinate,
    definition: "Each proposition makes its own independent contribution to a whole." },
  { code: "P", name: "Progression", symbol: "P", group: "coordinate", ...openCoordinate,
    definition: "Like series, but each proposition is a further step toward a climax." },
  { code: "A", name: "Alternative", symbol: "A", group: "coordinate", ...openCoordinate,
    definition: "Each proposition expresses a different possibility arising from a situation." },

  { code: "AcMn", name: "Action-Manner", symbol: "Ac/Mn", group: "restatement", ...pair,
    definition: "An action and a statement indicating the way or manner that action is carried out." },
  { code: "Cf", name: "Comparison", symbol: "Cf", group: "restatement", ...pair,
    definition: "An action and a statement that clarifies that action by showing what it is like." },
  { code: "NegPos", name: "Negative-Positive", symbol: NEG_POS_SYMBOL, group: "restatement", ...pair,
    definition: "Two statements, one of which is denied so that the other is enforced." },
  { code: "IdExp", name: "Idea-Explanation", symbol: "Id/Exp", group: "restatement", ...pair,
    definition: "The relationship between an original statement and one clarifying its meaning." },
  { code: "QA", name: "Question-Answer", symbol: "Q/A", group: "restatement", ...pair,
    definition: "The statement of a question and the answer to that question." },

  { code: "G", name: "Ground", symbol: "G", group: "distinct", ...pair,
    definition: "A statement and the argument or reason for that statement (supporting proposition follows).",
    warning: GROUND_INFERENCE_WARNING },
  // U+2234 THEREFORE, Piper's inference sign.
  { code: "Inf", name: "Inference", symbol: "\u2234", group: "distinct", ...pair,
    definition: "A statement and the argument or reason for that statement (supporting proposition precedes).",
    warning: GROUND_INFERENCE_WARNING },
  { code: "BL", name: "Bilateral", symbol: "BL", group: "distinct",
    minMembers: 3, maxMembers: 3, requiresCircle: false,
    definition: "A proposition that supports two other propositions, one preceding and one following." },
  { code: "AcRes", name: "Action-Result", symbol: "Ac/Res", group: "distinct",
    minMembers: 2, maxMembers: 2, requiresCircle: true,
    definition: "An action and a consequence or result which accompanies that action." },
  { code: "AcPur", name: "Action-Purpose", symbol: "Ac/Pur", group: "distinct",
    minMembers: 2, maxMembers: 2, requiresCircle: true,
    definition: "An action and its intended result." },
  { code: "IfTh", name: "Conditional", symbol: "If/Th", group: "distinct", ...pair,
    definition: "Like Action-Result except that the existence of the action is only potential and the result is contingent upon that action." },
  { code: "T", name: "Temporal", symbol: "T", group: "distinct", ...pair,
    definition: "A statement and the occasion when it is true or can occur." },
  { code: "L", name: "Locative", symbol: "L", group: "distinct", ...pair,
    definition: "A statement and the place where it is true or can occur." },

  { code: "Csv", name: "Concessive", symbol: "Csv", group: "contrary", ...pair,
    definition: "A main clause that stands despite a contrary statement." },
  { code: "SitR", name: "Situation-Response", symbol: "Sit/R", group: "contrary",
    minMembers: 2, maxMembers: 2, requiresCircle: true,
    definition: "A situation and its surprising or counter-intuitive response." },
];

export const CIRCLING_CODES: readonly RelCode[] = RELATIONSHIPS.filter((r) => r.requiresCircle).map((r) => r.code);

const BY_CODE = new Map(RELATIONSHIPS.map((r) => [r.code, r]));

export function relationship(code: RelCode): Relationship {
  const found = BY_CODE.get(code);
  if (!found) throw new Error(`unknown relationship: ${code}`);
  return found;
}
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `npx vitest run src/core/relationships.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Run the gate and commit**

```bash
npm run gate
git add src/core/relationships.ts src/core/relationships.test.ts
git commit -m "feat: the 18 logical relationships with Piper's groups and definitions"
```

---

### Task 3: Document types, ids, and the arc forest queries

**Files:**
- Create: `src/core/types.ts`, `src/core/doc.ts`, `src/core/tree.ts`
- Test: `src/core/doc.test.ts`, `src/core/tree.test.ts`

**Interfaces:**
- Consumes: `RelCode` from `src/core/relationships.ts`.
- Produces:
  - `src/core/types.ts`: `SCHEMA_VERSION = 1`; `ArcStatus`; `Verse {n, start}`; `Passage`; `Proposition {id, start, end, text}`; `Member = {kind:"prop", ref} | {kind:"arc", ref}`; `ArcNode {id, kind:"arc", rel, circled, members}`; `Level {text, connector}`; `Summary {mainPoint, levels, whyItMatters}`; `ArcDoc {schemaVersion, id, rev, createdAt, updatedAt, status, markedComplete, passage, propositions, arcs, summary}`
  - `src/core/doc.ts`: `referenceSlug(reference)`, `arcId(date, reference, taken)`, `localDate(now, timeZone)`, `normalizeText(raw)`, `newArcDoc(input): ArcDoc`
  - `src/core/tree.ts`: `arcById(doc, id)`, `memberKey(m)`, `topLevelUnits(doc)`, `propIndexRange(doc, unit)`, `propsUnder(doc, unit)`, `unitLevel(doc, unit)`, `isRooted(doc)`, `ancestorsOfProp(doc, propId)`, `ancestorsOfArc(doc, arcId)`

- [ ] **Step 1: Write `src/core/types.ts`** (types only, no behaviour, so no test cycle of its own)

```ts
import type { RelCode } from "./relationships";

export const SCHEMA_VERSION = 1;

export type ArcStatus = "split" | "relating" | "complete";

export interface Verse {
  n: number;
  /** Index into passage.text of the verse's first character. */
  start: number;
}

export interface Passage {
  reference: string;
  canonical: string;
  translation: "ESV";
  source: "esv-api" | "paste";
  fetchedAt: string;
  text: string;
  verses: Verse[];
}

export interface Proposition {
  id: string;
  start: number;
  end: number;
  text: string;
}

export type Member = { kind: "prop"; ref: string } | { kind: "arc"; ref: string };

export interface ArcNode {
  id: string;
  kind: "arc";
  rel: RelCode;
  /** 0-based member index for AcPur, AcRes and SitR, else null. */
  circled: number | null;
  members: Member[];
}

export interface Level {
  text: string;
  /** Free text into the level above. "" on the topmost level. */
  connector: string;
}

export interface Summary {
  mainPoint: string;
  /** levels[0] is the bottom, the most basic argument. */
  levels: Level[];
  whyItMatters: string;
}

export interface ArcDoc {
  schemaVersion: number;
  id: string;
  rev: number;
  createdAt: string;
  updatedAt: string;
  /** Derived on every save by deriveStatus. Never typed by a client. */
  status: ArcStatus;
  /**
   * Set true when Mark complete succeeds, false when it is undone. status
   * is "complete" only while this is true AND completionMissing is empty,
   * which is the spec's rule and cannot be computed without this flag.
   */
  markedComplete: boolean;
  passage: Passage;
  propositions: Proposition[];
  arcs: ArcNode[];
  summary: Summary;
}
```

- [ ] **Step 2: Write the failing test for `doc.ts`**

`src/core/doc.test.ts`:

```ts
import { expect, test } from "vitest";
import { arcId, localDate, newArcDoc, normalizeText, referenceSlug } from "./doc";

test("a reference slug is lowercase with single hyphens and no outer hyphens", () => {
  expect(referenceSlug("Romans 12:1-2")).toBe("romans-12-1-2");
  expect(referenceSlug("  1 John 4:7 - 12! ")).toBe("1-john-4-7-12");
});

test("an arc id is the date plus the slug", () => {
  expect(arcId("2026-09-05", "Romans 12:1-2", [])).toBe("2026-09-05-romans-12-1-2");
});

test("a colliding arc id takes the next numeric suffix", () => {
  const taken = ["2026-09-05-romans-12-1-2", "2026-09-05-romans-12-1-2-2"];
  expect(arcId("2026-09-05", "Romans 12:1-2", taken)).toBe("2026-09-05-romans-12-1-2-3");
});

test("the local date is the box timezone's calendar day, not UTC's", () => {
  // 2026-09-06T02:30:00Z is still Saturday evening in New York.
  const late = new Date("2026-09-06T02:30:00Z");
  expect(localDate(late, "America/New_York")).toBe("2026-09-05");
});

test("passage text is whitespace normalised on creation", () => {
  expect(normalizeText("  For by\n\n grace   you \t have been saved. ")).toBe(
    "For by grace you have been saved."
  );
});

test("a new arc starts as one proposition covering all of the text", () => {
  const doc = newArcDoc({
    id: "2026-09-05-romans-12-1-2",
    reference: "Romans 12:1-2",
    canonical: "Romans 12:1-2",
    source: "paste",
    text: "  I beseech you.  And do not be conformed. ",
    verses: [],
    now: new Date("2026-09-05T15:00:00Z"),
  });

  expect(doc.schemaVersion).toBe(1);
  expect(doc.rev).toBe(1);
  expect(doc.status).toBe("split");
  expect(doc.markedComplete).toBe(false);
  expect(doc.passage.text).toBe("I beseech you. And do not be conformed.");
  expect(doc.propositions).toEqual([
    { id: "p1", start: 0, end: 39, text: "I beseech you. And do not be conformed." },
  ]);
  expect(doc.arcs).toEqual([]);
  expect(doc.summary).toEqual({ mainPoint: "", levels: [], whyItMatters: "" });
});
```

- [ ] **Step 3: Run it and watch it fail**

Run: `npx vitest run src/core/doc.test.ts`
Expected: FAIL, "Failed to resolve import ./doc".

- [ ] **Step 4: Write `src/core/doc.ts`**

```ts
import { SCHEMA_VERSION, type ArcDoc, type Verse } from "./types";

/** Lowercase, runs of non-alphanumerics to one hyphen, outer hyphens dropped. */
export function referenceSlug(reference: string): string {
  return reference
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** date is YYYY-MM-DD. On collision append -2, then -3, and so on. */
export function arcId(date: string, reference: string, taken: readonly string[]): string {
  const base = `${date}-${referenceSlug(reference)}`;
  if (!taken.includes(base)) return base;
  let n = 2;
  while (taken.includes(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

/**
 * The calendar day in a named timezone. The box runs America/New_York and a
 * Saturday-night arc must not be filed under Sunday because UTC rolled over.
 * en-CA formats as YYYY-MM-DD.
 */
export function localDate(now: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(now);
}

/**
 * Collapse every whitespace run to a single space and trim. Propositions
 * index into this string, so it is normalised once at creation and never
 * again. The ESV API returns hard-wrapped paragraphs; a paste can carry
 * anything.
 */
export function normalizeText(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

export interface NewArcInput {
  id: string;
  reference: string;
  canonical: string;
  source: "esv-api" | "paste";
  text: string;
  verses: Verse[];
  now: Date;
}

export function newArcDoc(input: NewArcInput): ArcDoc {
  const text = normalizeText(input.text);
  const iso = input.now.toISOString();
  return {
    schemaVersion: SCHEMA_VERSION,
    id: input.id,
    rev: 1,
    createdAt: iso,
    updatedAt: iso,
    status: "split",
    markedComplete: false,
    passage: {
      reference: input.reference,
      canonical: input.canonical,
      translation: "ESV",
      source: input.source,
      fetchedAt: iso,
      text,
      verses: input.verses,
    },
    propositions: [{ id: "p1", start: 0, end: text.length, text }],
    arcs: [],
    summary: { mainPoint: "", levels: [], whyItMatters: "" },
  };
}
```

- [ ] **Step 5: Run the test and watch it pass**

Run: `npx vitest run src/core/doc.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 6: Write the failing test for `tree.ts`**

`src/core/tree.test.ts`:

```ts
import { expect, test } from "vitest";
import type { ArcDoc, ArcNode, Member } from "./types";
import {
  ancestorsOfProp,
  isRooted,
  propIndexRange,
  propsUnder,
  topLevelUnits,
  unitLevel,
} from "./tree";

/** Four propositions, no arcs. Text content is irrelevant to these queries. */
function baseDoc(): ArcDoc {
  const words = ["one", "two", "three", "four"];
  let at = 0;
  const propositions = words.map((w, i) => {
    const start = at;
    at += w.length + 1;
    return { id: `p${i + 1}`, start, end: at - 1, text: w };
  });
  return {
    schemaVersion: 1,
    id: "x",
    rev: 1,
    createdAt: "",
    updatedAt: "",
    status: "split",
    markedComplete: false,
    passage: {
      reference: "r", canonical: "r", translation: "ESV", source: "paste",
      fetchedAt: "", text: words.join(" "), verses: [],
    },
    propositions,
    arcs: [],
    summary: { mainPoint: "", levels: [], whyItMatters: "" },
  };
}

const prop = (ref: string): Member => ({ kind: "prop", ref });
const arc = (ref: string): Member => ({ kind: "arc", ref });

function nested(): ArcDoc {
  const doc = baseDoc();
  const arcs: ArcNode[] = [
    { id: "a1", kind: "arc", rel: "NegPos", circled: null, members: [prop("p2"), prop("p3")] },
    { id: "a2", kind: "arc", rel: "AcPur", circled: 1, members: [arc("a1"), prop("p4")] },
    { id: "a3", kind: "arc", rel: "AcPur", circled: 0, members: [prop("p1"), arc("a2")] },
  ];
  return { ...doc, arcs };
}

test("with no arcs every proposition is a top-level unit", () => {
  expect(topLevelUnits(baseDoc())).toEqual([prop("p1"), prop("p2"), prop("p3"), prop("p4")]);
});

test("a nested forest has one top-level unit", () => {
  expect(topLevelUnits(nested())).toEqual([arc("a3")]);
});

test("top-level units come back in passage order", () => {
  const doc = baseDoc();
  const partial: ArcDoc = {
    ...doc,
    arcs: [{ id: "a1", kind: "arc", rel: "NegPos", circled: null, members: [prop("p2"), prop("p3")] }],
  };
  expect(topLevelUnits(partial)).toEqual([prop("p1"), arc("a1"), prop("p4")]);
});

test("a unit's proposition range spans its deepest members", () => {
  expect(propIndexRange(nested(), arc("a2"))).toEqual({ first: 1, last: 3 });
  expect(propIndexRange(nested(), prop("p1"))).toEqual({ first: 0, last: 0 });
});

test("propsUnder lists every proposition beneath a unit in order", () => {
  expect(propsUnder(nested(), arc("a2"))).toEqual(["p2", "p3", "p4"]);
});

test("a proposition is level 0 and each enclosing arc is one deeper", () => {
  const doc = nested();
  expect(unitLevel(doc, prop("p1"))).toBe(0);
  expect(unitLevel(doc, arc("a1"))).toBe(1);
  expect(unitLevel(doc, arc("a2"))).toBe(2);
  expect(unitLevel(doc, arc("a3"))).toBe(3);
});

test("a doc is rooted when one top-level unit covers every proposition", () => {
  expect(isRooted(nested())).toBe(true);
  expect(isRooted(baseDoc())).toBe(false);
});

test("a single proposition and no arcs is not rooted", () => {
  const doc = baseDoc();
  const one: ArcDoc = { ...doc, propositions: [doc.propositions[0]] };
  expect(isRooted(one)).toBe(false);
});

test("ancestorsOfProp walks the chain outward in document order", () => {
  expect(ancestorsOfProp(nested(), "p3")).toEqual(["a1", "a2", "a3"]);
  expect(ancestorsOfProp(nested(), "p1")).toEqual(["a3"]);
});
```

- [ ] **Step 7: Run it and watch it fail**

Run: `npx vitest run src/core/tree.test.ts`
Expected: FAIL, "Failed to resolve import ./tree".

- [ ] **Step 8: Write `src/core/tree.ts`**

```ts
import type { ArcDoc, ArcNode, Member } from "./types";

export function memberKey(m: Member): string {
  return `${m.kind}:${m.ref}`;
}

export function arcById(doc: ArcDoc, id: string): ArcNode | undefined {
  return doc.arcs.find((a) => a.id === id);
}

function propIndex(doc: ArcDoc, propId: string): number {
  return doc.propositions.findIndex((p) => p.id === propId);
}

/** Every proposition id beneath a unit, in passage order. */
export function propsUnder(doc: ArcDoc, unit: Member): string[] {
  if (unit.kind === "prop") return [unit.ref];
  const node = arcById(doc, unit.ref);
  if (!node) return [];
  return node.members.flatMap((m) => propsUnder(doc, m));
}

export function propIndexRange(doc: ArcDoc, unit: Member): { first: number; last: number } {
  const indices = propsUnder(doc, unit).map((id) => propIndex(doc, id)).filter((i) => i >= 0);
  if (indices.length === 0) return { first: -1, last: -1 };
  return { first: Math.min(...indices), last: Math.max(...indices) };
}

/** A proposition is level 0; an arc is one deeper than its deepest member. */
export function unitLevel(doc: ArcDoc, unit: Member): number {
  if (unit.kind === "prop") return 0;
  const node = arcById(doc, unit.ref);
  if (!node) return 0;
  return 1 + Math.max(...node.members.map((m) => unitLevel(doc, m)));
}

/** Propositions and arcs that no arc holds, in passage order. */
export function topLevelUnits(doc: ArcDoc): Member[] {
  const held = new Set<string>();
  for (const a of doc.arcs) for (const m of a.members) held.add(memberKey(m));

  const units: Member[] = [];
  for (const p of doc.propositions) {
    const m: Member = { kind: "prop", ref: p.id };
    if (!held.has(memberKey(m))) units.push(m);
  }
  for (const a of doc.arcs) {
    const m: Member = { kind: "arc", ref: a.id };
    if (!held.has(memberKey(m))) units.push(m);
  }
  return units.sort((x, y) => propIndexRange(doc, x).first - propIndexRange(doc, y).first);
}

/** One top-level unit covering every proposition. Enables Summarize. */
export function isRooted(doc: ArcDoc): boolean {
  const units = topLevelUnits(doc);
  if (units.length !== 1) return false;
  return propsUnder(doc, units[0]).length === doc.propositions.length;
}

/** Every arc holding this proposition, directly or through a nested member. */
export function ancestorsOfProp(doc: ArcDoc, propId: string): string[] {
  return doc.arcs.filter((a) => propsUnder(doc, { kind: "arc", ref: a.id }).includes(propId)).map((a) => a.id);
}

/** Every arc holding this arc, directly or through a nested member. */
export function ancestorsOfArc(doc: ArcDoc, arcId: string): string[] {
  const out: string[] = [];
  let current = arcId;
  for (;;) {
    const parent = doc.arcs.find((a) => a.members.some((m) => m.kind === "arc" && m.ref === current));
    if (!parent) return out;
    out.push(parent.id);
    current = parent.id;
  }
}
```

- [ ] **Step 9: Run the tests and watch them pass**

Run: `npx vitest run src/core/tree.test.ts src/core/doc.test.ts`
Expected: PASS, 15 tests.

- [ ] **Step 10: Run the gate and commit**

```bash
npm run gate
git add src/core/types.ts src/core/doc.ts src/core/tree.ts src/core/doc.test.ts src/core/tree.test.ts
git commit -m "feat: document types, arc ids, and arc forest queries"
```

---

### Task 4: validateDoc and the derived status

**Files:**
- Create: `src/core/status.ts`, `src/core/validate.ts`
- Test: `src/core/status.test.ts`, `src/core/validate.test.ts`

**Interfaces:**
- Consumes: `ArcDoc`, `Member` from `src/core/types.ts`; `isRooted`, `propIndexRange`, `propsUnder`, `arcById` from `src/core/tree.ts`; `relationship`, `RELATIONSHIPS` from `src/core/relationships.ts`.
- Produces:
  - `src/core/status.ts`: `completionMissing(doc): string[]`, `deriveStatus(doc): ArcStatus`
  - `src/core/validate.ts`: `interface Violation { code: string; message: string }`, `validateDoc(doc: ArcDoc): Violation[]`

- [ ] **Step 1: Write the failing test for `status.ts`**

`src/core/status.test.ts`:

```ts
import { expect, test } from "vitest";
import { newArcDoc } from "./doc";
import { completionMissing, deriveStatus } from "./status";
import type { ArcDoc } from "./types";

function docWith(patch: Partial<ArcDoc>): ArcDoc {
  const base = newArcDoc({
    id: "d", reference: "Romans 12:1-2", canonical: "Romans 12:1-2", source: "paste",
    text: "one two three four", verses: [], now: new Date("2026-09-05T15:00:00Z"),
  });
  const propositions = [
    { id: "p1", start: 0, end: 3, text: "one" },
    { id: "p2", start: 4, end: 18, text: "two three four" },
  ];
  return { ...base, propositions, ...patch };
}

test("status is split with no arcs", () => {
  expect(deriveStatus(docWith({}))).toBe("split");
});

test("status is relating once an arc exists", () => {
  const doc = docWith({
    arcs: [{ id: "a1", kind: "arc", rel: "G", circled: null, members: [{ kind: "prop", ref: "p1" }, { kind: "prop", ref: "p2" }] }],
  });
  expect(deriveStatus(doc)).toBe("relating");
});

test("status is complete only when marked and the conditions still hold", () => {
  const doc = docWith({
    markedComplete: true,
    arcs: [{ id: "a1", kind: "arc", rel: "G", circled: null, members: [{ kind: "prop", ref: "p1" }, { kind: "prop", ref: "p2" }] }],
    summary: { mainPoint: "God is glorified in mercy.", levels: [{ text: "bottom", connector: "" }], whyItMatters: "" },
  });
  expect(completionMissing(doc)).toEqual([]);
  expect(deriveStatus(doc)).toBe("complete");
});

test("marking complete does not survive a condition breaking", () => {
  const doc = docWith({
    markedComplete: true,
    arcs: [],
    summary: { mainPoint: "God is glorified in mercy.", levels: [{ text: "bottom", connector: "" }], whyItMatters: "" },
  });
  expect(deriveStatus(doc)).toBe("split");
});

test("the missing list names every unmet condition", () => {
  const doc = docWith({
    arcs: [{ id: "a1", kind: "arc", rel: "AcPur", circled: null, members: [{ kind: "prop", ref: "p1" }, { kind: "prop", ref: "p2" }] }],
    summary: { mainPoint: "   ", levels: [{ text: "", connector: "" }], whyItMatters: "" },
  });
  expect(completionMissing(doc)).toEqual([
    "A main point sentence",
    "At least one level with text",
    "A circled member on the Action-Purpose arc (a1)",
  ]);
});

test("an unrooted passage is itself a missing condition", () => {
  expect(completionMissing(docWith({}))).toContain("One arc spanning the whole passage");
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/core/status.test.ts`
Expected: FAIL, "Failed to resolve import ./status".

- [ ] **Step 3: Write `src/core/status.ts`**

```ts
import { relationship } from "./relationships";
import { isRooted } from "./tree";
import type { ArcDoc, ArcStatus } from "./types";

/**
 * What Mark complete is still waiting on, in the order the Summarize screen
 * lists it. Empty means Mark complete is allowed. One function so the button
 * gating and the derived status can never drift apart.
 */
export function completionMissing(doc: ArcDoc): string[] {
  const missing: string[] = [];
  if (!isRooted(doc)) missing.push("One arc spanning the whole passage");
  if (!doc.summary.mainPoint.trim()) missing.push("A main point sentence");
  if (!doc.summary.levels.some((l) => l.text.trim())) missing.push("At least one level with text");
  for (const arc of doc.arcs) {
    const rel = relationship(arc.rel);
    if (rel.requiresCircle && arc.circled === null) {
      missing.push(`A circled member on the ${rel.name} arc (${arc.id})`);
    }
  }
  return missing;
}

/** Derived on every save, never typed by a client. */
export function deriveStatus(doc: ArcDoc): ArcStatus {
  if (doc.markedComplete && completionMissing(doc).length === 0) return "complete";
  return doc.arcs.length > 0 ? "relating" : "split";
}
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `npx vitest run src/core/status.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Write the failing test for `validate.ts`**

`src/core/validate.test.ts`:

```ts
import { expect, test } from "vitest";
import { newArcDoc } from "./doc";
import type { ArcDoc } from "./types";
import { validateDoc } from "./validate";

const TEXT = "one two three four";

function twoProps(): ArcDoc {
  const base = newArcDoc({
    id: "d", reference: "Romans 12:1-2", canonical: "Romans 12:1-2", source: "paste",
    text: TEXT, verses: [], now: new Date("2026-09-05T15:00:00Z"),
  });
  return {
    ...base,
    propositions: [
      { id: "p1", start: 0, end: 4, text: "one" },
      { id: "p2", start: 4, end: 18, text: "two three four" },
    ],
  };
}

const codes = (doc: ArcDoc) => validateDoc(doc).map((v) => v.code);

test("a freshly created document is valid", () => {
  const doc = newArcDoc({
    id: "d", reference: "Romans 12:1-2", canonical: "Romans 12:1-2", source: "paste",
    text: TEXT, verses: [], now: new Date("2026-09-05T15:00:00Z"),
  });
  expect(validateDoc(doc)).toEqual([]);
});

test("a wrong schema version is a violation", () => {
  expect(codes({ ...twoProps(), schemaVersion: 2 })).toContain("schema_version");
});

test("propositions must tile the text with no gap", () => {
  const doc = twoProps();
  doc.propositions[1] = { ...doc.propositions[1], start: 5 };
  expect(codes(doc)).toContain("tiling_gap");
});

test("propositions must not overlap", () => {
  const doc = twoProps();
  doc.propositions[1] = { ...doc.propositions[1], start: 3 };
  expect(codes(doc)).toContain("tiling_gap");
});

test("the last proposition must reach the end of the text", () => {
  const doc = twoProps();
  doc.propositions[1] = { ...doc.propositions[1], end: 14 };
  expect(codes(doc)).toContain("tiling_end");
});

test("a boundary that is not a word start is a violation", () => {
  const doc = twoProps();
  doc.propositions[0] = { id: "p1", start: 0, end: 6, text: "one tw" };
  doc.propositions[1] = { id: "p2", start: 6, end: 18, text: "o three four" };
  expect(codes(doc)).toContain("boundary_not_word_start");
});

test("proposition ids must be p1..pn in order", () => {
  const doc = twoProps();
  doc.propositions[1] = { ...doc.propositions[1], id: "p9" };
  expect(codes(doc)).toContain("proposition_id");
});

test("proposition text must match the slice of the passage", () => {
  const doc = twoProps();
  doc.propositions[0] = { ...doc.propositions[0], text: "ONE" };
  expect(codes(doc)).toContain("proposition_text");
});

test("an arc member that does not resolve is a violation", () => {
  const doc = twoProps();
  doc.arcs = [{ id: "a1", kind: "arc", rel: "G", circled: null, members: [{ kind: "prop", ref: "p1" }, { kind: "prop", ref: "p7" }] }];
  expect(codes(doc)).toContain("member_unknown");
});

test("a proposition may not appear in two arcs", () => {
  const doc = twoProps();
  doc.arcs = [
    { id: "a1", kind: "arc", rel: "G", circled: null, members: [{ kind: "prop", ref: "p1" }, { kind: "prop", ref: "p2" }] },
    { id: "a2", kind: "arc", rel: "G", circled: null, members: [{ kind: "prop", ref: "p2" }, { kind: "prop", ref: "p1" }] },
  ];
  expect(codes(doc)).toContain("member_reused");
});

test("an arc that contains itself is caught before anything recurses", () => {
  const doc = twoProps();
  doc.arcs = [{ id: "a1", kind: "arc", rel: "G", circled: null, members: [{ kind: "arc", ref: "a1" }, { kind: "prop", ref: "p1" }] }];
  expect(codes(doc)).toContain("member_cycle");
});

test("member counts follow the relationship", () => {
  const doc = twoProps();
  doc.arcs = [{ id: "a1", kind: "arc", rel: "BL", circled: null, members: [{ kind: "prop", ref: "p1" }, { kind: "prop", ref: "p2" }] }];
  expect(codes(doc)).toContain("member_count");
});

test("members must be adjacent and in passage order", () => {
  const base = newArcDoc({
    id: "d", reference: "Romans 12:1-2", canonical: "Romans 12:1-2", source: "paste",
    text: TEXT, verses: [], now: new Date("2026-09-05T15:00:00Z"),
  });
  const doc: ArcDoc = {
    ...base,
    propositions: [
      { id: "p1", start: 0, end: 4, text: "one" },
      { id: "p2", start: 4, end: 8, text: "two" },
      { id: "p3", start: 8, end: 18, text: "three four" },
    ],
    arcs: [{ id: "a1", kind: "arc", rel: "G", circled: null, members: [{ kind: "prop", ref: "p1" }, { kind: "prop", ref: "p3" }] }],
  };
  expect(codes(doc)).toContain("member_not_adjacent");
});

test("only the three circling relationships may carry a circled index", () => {
  const doc = twoProps();
  doc.arcs = [{ id: "a1", kind: "arc", rel: "G", circled: 0, members: [{ kind: "prop", ref: "p1" }, { kind: "prop", ref: "p2" }] }];
  expect(codes(doc)).toContain("circle_not_allowed");
});

test("a circled index must point at a real member", () => {
  const doc = twoProps();
  doc.arcs = [{ id: "a1", kind: "arc", rel: "AcPur", circled: 5, members: [{ kind: "prop", ref: "p1" }, { kind: "prop", ref: "p2" }] }];
  expect(codes(doc)).toContain("circle_range");
});

test("the topmost level carries no connector", () => {
  const doc = twoProps();
  doc.summary = { mainPoint: "x", levels: [{ text: "a", connector: "therefore" }, { text: "b", connector: "so" }], whyItMatters: "" };
  expect(codes(doc)).toContain("top_connector");
});

test("a typed status that disagrees with the derived one is a violation", () => {
  const doc = twoProps();
  doc.status = "complete";
  expect(codes(doc)).toContain("status_derived");
});
```

- [ ] **Step 6: Run it and watch it fail**

Run: `npx vitest run src/core/validate.test.ts`
Expected: FAIL, "Failed to resolve import ./validate".

- [ ] **Step 7: Write `src/core/validate.ts`**

```ts
import { relationship } from "./relationships";
import { deriveStatus } from "./status";
import { arcById, memberKey, propIndexRange } from "./tree";
import { SCHEMA_VERSION, type ArcDoc, type Member } from "./types";

export interface Violation {
  code: string;
  message: string;
}

/**
 * The one authority on a legal document. The PUT route rejects any body
 * that produces a violation, so every rule the core enforces has to be
 * expressed here rather than in a screen.
 *
 * Structural problems (unknown member, cycle) are checked and returned
 * FIRST, on their own: propIndexRange and propsUnder recurse through
 * members and would not terminate on a cycle.
 */
export function validateDoc(doc: ArcDoc): Violation[] {
  const v: Violation[] = [];
  const push = (code: string, message: string) => v.push({ code, message });

  const structural = structuralViolations(doc);
  if (structural.length > 0) return structural;

  if (doc.schemaVersion !== SCHEMA_VERSION) {
    push("schema_version", `schemaVersion must be ${SCHEMA_VERSION}`);
  }

  const text = doc.passage.text;
  if (doc.propositions.length === 0) push("propositions_empty", "a document has at least one proposition");

  doc.propositions.forEach((p, i) => {
    if (p.id !== `p${i + 1}`) push("proposition_id", `proposition ${i} should be p${i + 1}, found ${p.id}`);
    if (p.start >= p.end) push("tiling_gap", `proposition ${p.id} is empty`);
    const expectedStart = i === 0 ? 0 : doc.propositions[i - 1].end;
    if (p.start !== expectedStart) {
      push("tiling_gap", `proposition ${p.id} starts at ${p.start}, expected ${expectedStart}`);
    }
    if (i > 0 && !isWordStart(text, p.start)) {
      push("boundary_not_word_start", `proposition ${p.id} does not start on a word`);
    }
    if (p.text !== text.slice(p.start, p.end).trim()) {
      push("proposition_text", `proposition ${p.id} text does not match the passage slice`);
    }
  });

  const last = doc.propositions[doc.propositions.length - 1];
  if (last && last.end !== text.length) {
    push("tiling_end", `the last proposition ends at ${last.end}, expected ${text.length}`);
  }

  for (const arc of doc.arcs) {
    const rel = relationship(arc.rel);
    const n = arc.members.length;
    const okCount = rel.maxMembers === null ? n >= rel.minMembers : n === rel.minMembers;
    if (!okCount) {
      const want = rel.maxMembers === null ? `${rel.minMembers} or more` : `exactly ${rel.minMembers}`;
      push("member_count", `${arc.id} (${rel.name}) takes ${want} members, found ${n}`);
    }

    for (let i = 1; i < arc.members.length; i += 1) {
      const before = propIndexRange(doc, arc.members[i - 1]);
      const after = propIndexRange(doc, arc.members[i]);
      if (before.last + 1 !== after.first) {
        push("member_not_adjacent", `${arc.id} members ${i - 1} and ${i} are not adjacent`);
      }
    }

    if (!rel.requiresCircle && arc.circled !== null) {
      push("circle_not_allowed", `${arc.id} (${rel.name}) does not take a circled member`);
    }
    if (arc.circled !== null && (!Number.isInteger(arc.circled) || arc.circled < 0 || arc.circled >= n)) {
      push("circle_range", `${arc.id} circled index ${arc.circled} is out of range`);
    }
  }

  const levels = doc.summary.levels;
  if (levels.length > 0 && levels[levels.length - 1].connector !== "") {
    push("top_connector", "the topmost level carries no connector");
  }

  if (doc.status !== deriveStatus(doc)) {
    push("status_derived", `status is ${doc.status}, derived is ${deriveStatus(doc)}`);
  }

  return v;
}

export function isWordStart(text: string, index: number): boolean {
  if (index <= 0) return index === 0;
  if (index >= text.length) return false;
  return /\S/.test(text[index]) && /\s/.test(text[index - 1]);
}

function structuralViolations(doc: ArcDoc): Violation[] {
  const v: Violation[] = [];
  const propIds = new Set(doc.propositions.map((p) => p.id));
  const arcIds = new Set(doc.arcs.map((a) => a.id));
  if (arcIds.size !== doc.arcs.length) v.push({ code: "arc_id", message: "arc ids must be unique" });

  const seen = new Map<string, number>();
  for (const arc of doc.arcs) {
    for (const m of arc.members) {
      const known = m.kind === "prop" ? propIds.has(m.ref) : arcIds.has(m.ref);
      if (!known) v.push({ code: "member_unknown", message: `${arc.id} holds unknown member ${memberKey(m)}` });
      const count = (seen.get(memberKey(m)) ?? 0) + 1;
      seen.set(memberKey(m), count);
      if (count === 2) v.push({ code: "member_reused", message: `${memberKey(m)} is held by more than one arc` });
    }
  }

  if (hasCycle(doc)) v.push({ code: "member_cycle", message: "an arc contains itself" });
  return v;
}

function hasCycle(doc: ArcDoc): boolean {
  const state = new Map<string, "open" | "done">();
  const walk = (id: string): boolean => {
    const seen = state.get(id);
    if (seen === "open") return true;
    if (seen === "done") return false;
    state.set(id, "open");
    const node = arcById(doc, id);
    const members: Member[] = node ? node.members : [];
    for (const m of members) {
      if (m.kind === "arc" && walk(m.ref)) return true;
    }
    state.set(id, "done");
    return false;
  };
  return doc.arcs.some((a) => walk(a.id));
}
```

- [ ] **Step 8: Run the test and watch it pass**

Run: `npx vitest run src/core/validate.test.ts`
Expected: PASS, 18 tests.

- [ ] **Step 9: Run the gate and commit**

```bash
npm run gate
git add src/core/status.ts src/core/validate.ts src/core/status.test.ts src/core/validate.test.ts
git commit -m "feat: document validation and the derived status"
```

---

### Task 5: Split and rejoin

**Files:**
- Create: `src/core/split.ts`
- Test: `src/core/split.test.ts`

**Interfaces:**
- Consumes: `ArcDoc`, `Proposition` from `src/core/types.ts`; `deriveStatus` from `src/core/status.ts`; `isWordStart` from `src/core/validate.ts`; `ancestorsOfProp` from `src/core/tree.ts`.
- Produces:
  - `wordStarts(text: string): number[]`
  - `propositionAt(doc: ArcDoc, charIndex: number): Proposition | undefined`
  - `arcsDissolvedBySplit(doc: ArcDoc, charIndex: number): string[]`
  - `arcsDissolvedByRejoin(doc: ArcDoc, propId: string): string[]`
  - `splitAt(doc: ArcDoc, charIndex: number): ArcDoc`
  - `rejoinAt(doc: ArcDoc, propId: string): ArcDoc`

- [ ] **Step 1: Write the failing test**

`src/core/split.test.ts`:

```ts
import fc from "fast-check";
import { expect, test } from "vitest";
import { newArcDoc } from "./doc";
import { arcsDissolvedByRejoin, arcsDissolvedBySplit, rejoinAt, splitAt, wordStarts } from "./split";
import type { ArcDoc } from "./types";
import { validateDoc } from "./validate";

const TEXT = "one two three four five";

function fresh(): ArcDoc {
  return newArcDoc({
    id: "d", reference: "Romans 12:1-2", canonical: "Romans 12:1-2", source: "paste",
    text: TEXT, verses: [], now: new Date("2026-09-05T15:00:00Z"),
  });
}

test("word starts are the index of every word's first character", () => {
  expect(wordStarts(TEXT)).toEqual([0, 4, 8, 14, 19]);
});

test("splitting at a word start makes two propositions numbered from one", () => {
  const doc = splitAt(fresh(), 8);
  expect(doc.propositions).toEqual([
    { id: "p1", start: 0, end: 8, text: "one two" },
    { id: "p2", start: 8, end: 23, text: "three four five" },
  ]);
  expect(validateDoc(doc)).toEqual([]);
});

test("splitting mid-word is refused", () => {
  expect(() => splitAt(fresh(), 9)).toThrow(/word start/);
});

test("splitting at an existing boundary is refused", () => {
  const doc = splitAt(fresh(), 8);
  expect(() => splitAt(doc, 8)).toThrow(/already a boundary/);
});

test("propositions renumber after a middle split", () => {
  let doc = splitAt(fresh(), 14);
  doc = splitAt(doc, 4);
  expect(doc.propositions.map((p) => p.id)).toEqual(["p1", "p2", "p3"]);
  expect(doc.propositions.map((p) => p.text)).toEqual(["one", "two three", "four five"]);
});

test("rejoining folds a proposition back into the one before it", () => {
  const doc = rejoinAt(splitAt(fresh(), 8), "p2");
  expect(doc.propositions).toEqual([{ id: "p1", start: 0, end: 23, text: TEXT }]);
});

test("rejoining the first proposition is refused", () => {
  expect(() => rejoinAt(splitAt(fresh(), 8), "p1")).toThrow(/first proposition/);
});

test("a split dissolves every arc holding the affected proposition, nested included", () => {
  let doc = splitAt(fresh(), 8);
  doc = splitAt(doc, 14);
  doc = splitAt(doc, 19);
  doc = {
    ...doc,
    arcs: [
      { id: "a1", kind: "arc", rel: "NegPos", circled: null, members: [{ kind: "prop", ref: "p1" }, { kind: "prop", ref: "p2" }] },
      { id: "a2", kind: "arc", rel: "G", circled: null, members: [{ kind: "arc", ref: "a1" }, { kind: "prop", ref: "p3" }] },
      { id: "a3", kind: "arc", rel: "S", circled: null, members: [{ kind: "arc", ref: "a2" }, { kind: "prop", ref: "p4" }] },
    ],
    status: "relating",
  };

  expect(arcsDissolvedBySplit(doc, 4)).toEqual(["a1", "a2", "a3"]);

  const after = splitAt(doc, 4);
  expect(after.arcs).toEqual([]);
  expect(after.propositions).toHaveLength(5);
  expect(validateDoc(after)).toEqual([]);
});

test("arcs that do not hold the affected proposition survive with remapped refs", () => {
  let doc = splitAt(fresh(), 8);
  doc = splitAt(doc, 14);
  doc = {
    ...doc,
    arcs: [{ id: "a1", kind: "arc", rel: "G", circled: null, members: [{ kind: "prop", ref: "p2" }, { kind: "prop", ref: "p3" }] }],
    status: "relating",
  };

  expect(arcsDissolvedBySplit(doc, 4)).toEqual([]);

  const after = splitAt(doc, 4);
  expect(after.propositions.map((p) => p.text)).toEqual(["one", "two", "three", "four five"]);
  // p2 and p3 became p3 and p4 when the earlier split renumbered them.
  expect(after.arcs[0].members).toEqual([{ kind: "prop", ref: "p3" }, { kind: "prop", ref: "p4" }]);
  expect(validateDoc(after)).toEqual([]);
});

test("a rejoin dissolves the arcs holding either side", () => {
  let doc = splitAt(fresh(), 8);
  doc = splitAt(doc, 14);
  doc = {
    ...doc,
    arcs: [{ id: "a1", kind: "arc", rel: "G", circled: null, members: [{ kind: "prop", ref: "p2" }, { kind: "prop", ref: "p3" }] }],
    status: "relating",
  };
  expect(arcsDissolvedByRejoin(doc, "p3")).toEqual(["a1"]);
  expect(rejoinAt(doc, "p3").arcs).toEqual([]);
});

test("status returns to split when the last arc dissolves", () => {
  let doc = splitAt(fresh(), 8);
  doc = {
    ...doc,
    arcs: [{ id: "a1", kind: "arc", rel: "G", circled: null, members: [{ kind: "prop", ref: "p1" }, { kind: "prop", ref: "p2" }] }],
    status: "relating",
  };
  expect(rejoinAt(doc, "p2").status).toBe("split");
});

test("the tiling invariant survives any sequence of splits and rejoins", () => {
  fc.assert(
    fc.property(fc.array(fc.nat(50), { maxLength: 40 }), (seq) => {
      let doc = fresh();
      for (const n of seq) {
        const open = wordStarts(doc.passage.text).filter(
          (s) => s > 0 && !doc.propositions.some((p) => p.start === s)
        );
        if (n % 2 === 0 && open.length > 0) {
          doc = splitAt(doc, open[n % open.length]);
        } else if (doc.propositions.length > 1) {
          doc = rejoinAt(doc, doc.propositions[1 + (n % (doc.propositions.length - 1))].id);
        }
        expect(validateDoc(doc)).toEqual([]);
      }
    })
  );
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/core/split.test.ts`
Expected: FAIL, "Failed to resolve import ./split".

- [ ] **Step 3: Write `src/core/split.ts`**

```ts
import { deriveStatus } from "./status";
import { ancestorsOfProp } from "./tree";
import type { ArcDoc, Member, Proposition } from "./types";
import { isWordStart } from "./validate";

/** Index of the first character of every word in the passage. */
export function wordStarts(text: string): number[] {
  const starts: number[] = [];
  for (let i = 0; i < text.length; i += 1) {
    if (/\S/.test(text[i]) && (i === 0 || /\s/.test(text[i - 1]))) starts.push(i);
  }
  return starts;
}

export function propositionAt(doc: ArcDoc, charIndex: number): Proposition | undefined {
  return doc.propositions.find((p) => charIndex >= p.start && charIndex < p.end);
}

export function arcsDissolvedBySplit(doc: ArcDoc, charIndex: number): string[] {
  const target = propositionAt(doc, charIndex);
  return target ? ancestorsOfProp(doc, target.id) : [];
}

export function arcsDissolvedByRejoin(doc: ArcDoc, propId: string): string[] {
  const index = doc.propositions.findIndex((p) => p.id === propId);
  if (index <= 0) return [];
  const previous = doc.propositions[index - 1].id;
  const affected = new Set([...ancestorsOfProp(doc, previous), ...ancestorsOfProp(doc, propId)]);
  return doc.arcs.filter((a) => affected.has(a.id)).map((a) => a.id);
}

export function splitAt(doc: ArcDoc, charIndex: number): ArcDoc {
  if (!isWordStart(doc.passage.text, charIndex) || charIndex === 0) {
    throw new Error(`split index ${charIndex} is not a word start`);
  }
  if (doc.propositions.some((p) => p.start === charIndex)) {
    throw new Error(`split index ${charIndex} is already a boundary`);
  }
  const starts = [...doc.propositions.map((p) => p.start), charIndex].sort((a, b) => a - b);
  return rebuild(doc, starts, new Set(arcsDissolvedBySplit(doc, charIndex)));
}

export function rejoinAt(doc: ArcDoc, propId: string): ArcDoc {
  const index = doc.propositions.findIndex((p) => p.id === propId);
  if (index < 0) throw new Error(`unknown proposition ${propId}`);
  if (index === 0) throw new Error("the first proposition has nothing before it to rejoin");
  const dropped = doc.propositions[index].start;
  const starts = doc.propositions.map((p) => p.start).filter((s) => s !== dropped);
  return rebuild(doc, starts, new Set(arcsDissolvedByRejoin(doc, propId)));
}

/**
 * Rebuild the propositions from a boundary list, renumber them p1..pn, drop
 * the dissolved arcs and remap the survivors' proposition refs.
 *
 * Remapping is by START OFFSET, which is sound because every arc touching a
 * proposition whose start moved is in the dissolved set by construction.
 */
function rebuild(doc: ArcDoc, starts: number[], dissolved: Set<string>): ArcDoc {
  const text = doc.passage.text;
  const propositions: Proposition[] = starts.map((start, i) => {
    const end = i + 1 < starts.length ? starts[i + 1] : text.length;
    return { id: `p${i + 1}`, start, end, text: text.slice(start, end).trim() };
  });

  const idByStart = new Map(propositions.map((p) => [p.start, p.id]));
  const remap = new Map<string, string>();
  for (const old of doc.propositions) {
    const next = idByStart.get(old.start);
    if (next) remap.set(old.id, next);
  }

  const arcs = doc.arcs
    .filter((a) => !dissolved.has(a.id))
    .map((a) => ({
      ...a,
      members: a.members.map((m): Member => (m.kind === "prop" ? { kind: "prop", ref: remap.get(m.ref) ?? m.ref } : m)),
    }));

  const next: ArcDoc = { ...doc, propositions, arcs };
  return { ...next, status: deriveStatus(next) };
}
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `npx vitest run src/core/split.test.ts`
Expected: PASS, 12 tests, including the fast-check property over 100 random sequences.

- [ ] **Step 5: Run the gate and commit**

```bash
npm run gate
git add src/core/split.ts src/core/split.test.ts
git commit -m "feat: split and rejoin propositions with dissolve-on-resplit"
```

---

### Task 6: Building, relabelling and dissolving arcs

**Files:**
- Create: `src/core/arcTree.ts`
- Test: `src/core/arcTree.test.ts`

**Interfaces:**
- Consumes: `relationship`, `RelCode` from `src/core/relationships.ts`; `topLevelUnits`, `propIndexRange`, `ancestorsOfArc`, `memberKey` from `src/core/tree.ts`; `deriveStatus` from `src/core/status.ts`.
- Produces:
  - `interface Fit { ok: boolean; reason?: string }`
  - `canRelate(doc: ArcDoc, units: Member[], code: RelCode): Fit`
  - `unitsAreAdjacentTopLevel(doc: ArcDoc, units: Member[]): boolean`
  - `nextArcId(doc: ArcDoc): string`
  - `createArc(doc: ArcDoc, units: Member[], code: RelCode): ArcDoc`
  - `relabelArc(doc: ArcDoc, arcId: string, code: RelCode): ArcDoc`
  - `arcsDissolvedByDissolve(doc: ArcDoc, arcId: string): string[]`
  - `dissolveArc(doc: ArcDoc, arcId: string): ArcDoc`
  - `setCircled(doc: ArcDoc, arcId: string, memberIndex: number | null): ArcDoc`

- [ ] **Step 1: Write the failing test**

`src/core/arcTree.test.ts`:

```ts
import { expect, test } from "vitest";
import {
  arcsDissolvedByDissolve,
  canRelate,
  createArc,
  dissolveArc,
  relabelArc,
  setCircled,
} from "./arcTree";
import { newArcDoc } from "./doc";
import { splitAt } from "./split";
import type { ArcDoc, Member } from "./types";
import { validateDoc } from "./validate";

const prop = (ref: string): Member => ({ kind: "prop", ref });
const arc = (ref: string): Member => ({ kind: "arc", ref });

/** "one two three four five" as five propositions. */
function fiveProps(): ArcDoc {
  let doc = newArcDoc({
    id: "d", reference: "Romans 12:1-2", canonical: "Romans 12:1-2", source: "paste",
    text: "one two three four five", verses: [], now: new Date("2026-09-05T15:00:00Z"),
  });
  for (const at of [4, 8, 14, 19]) doc = splitAt(doc, at);
  return doc;
}

test("two neighbours fit a pair relationship", () => {
  expect(canRelate(fiveProps(), [prop("p1"), prop("p2")], "G")).toEqual({ ok: true });
});

test("units that are not neighbours keep the palette closed", () => {
  expect(canRelate(fiveProps(), [prop("p1"), prop("p3")], "G")).toEqual({
    ok: false,
    reason: "Select neighbours",
  });
});

test("three neighbours fit only Series, Progression, Alternative and Bilateral", () => {
  const doc = fiveProps();
  const three = [prop("p1"), prop("p2"), prop("p3")];
  for (const code of ["S", "P", "A", "BL"] as const) {
    expect(canRelate(doc, three, code).ok).toBe(true);
  }
  for (const code of ["G", "Inf", "AcPur", "NegPos", "Csv", "SitR", "T", "L", "Cf"] as const) {
    expect(canRelate(doc, three, code)).toEqual({ ok: false, reason: "Takes exactly 2" });
  }
});

test("Bilateral refuses two members", () => {
  expect(canRelate(fiveProps(), [prop("p1"), prop("p2")], "BL")).toEqual({
    ok: false,
    reason: "Takes exactly 3",
  });
});

test("a single unit fits nothing", () => {
  expect(canRelate(fiveProps(), [prop("p1")], "S")).toEqual({
    ok: false,
    reason: "Select two or more neighbours",
  });
});

test("creating an arc puts it in the forest and leaves the document valid", () => {
  const doc = createArc(fiveProps(), [prop("p1"), prop("p2")], "G");
  expect(doc.arcs).toEqual([
    { id: "a1", kind: "arc", rel: "G", circled: null, members: [prop("p1"), prop("p2")] },
  ]);
  expect(doc.status).toBe("relating");
  expect(validateDoc(doc)).toEqual([]);
});

test("members are stored in passage order however they were selected", () => {
  const doc = createArc(fiveProps(), [prop("p2"), prop("p1")], "G");
  expect(doc.arcs[0].members).toEqual([prop("p1"), prop("p2")]);
});

test("arc ids do not reuse a dissolved id", () => {
  let doc = createArc(fiveProps(), [prop("p1"), prop("p2")], "G");
  doc = createArc(doc, [prop("p3"), prop("p4")], "G");
  doc = dissolveArc(doc, "a1");
  doc = createArc(doc, [prop("p1"), prop("p2")], "G");
  expect(doc.arcs.map((a) => a.id)).toEqual(["a2", "a3"]);
});

test("an arc can be nested inside another arc", () => {
  let doc = createArc(fiveProps(), [prop("p1"), prop("p2")], "NegPos");
  doc = createArc(doc, [arc("a1"), prop("p3")], "AcPur");
  expect(doc.arcs[1].members).toEqual([arc("a1"), prop("p3")]);
  expect(validateDoc(doc)).toEqual([]);
});

test("relabelling keeps the members and clears a circle the new label cannot carry", () => {
  let doc = createArc(fiveProps(), [prop("p1"), prop("p2")], "AcPur");
  doc = setCircled(doc, "a1", 1);
  doc = relabelArc(doc, "a1", "G");
  expect(doc.arcs[0].rel).toBe("G");
  expect(doc.arcs[0].circled).toBeNull();
  expect(validateDoc(doc)).toEqual([]);
});

test("relabelling to a member count the arc cannot satisfy is refused", () => {
  const doc = createArc(fiveProps(), [prop("p1"), prop("p2")], "G");
  expect(() => relabelArc(doc, "a1", "BL")).toThrow(/Takes exactly 3/);
});

test("circling one member moves the circle off the other", () => {
  let doc = createArc(fiveProps(), [prop("p1"), prop("p2")], "AcPur");
  doc = setCircled(doc, "a1", 0);
  expect(doc.arcs[0].circled).toBe(0);
  doc = setCircled(doc, "a1", 1);
  expect(doc.arcs[0].circled).toBe(1);
});

test("circling a relationship that does not circle is refused", () => {
  const doc = createArc(fiveProps(), [prop("p1"), prop("p2")], "G");
  expect(() => setCircled(doc, "a1", 0)).toThrow(/does not take a circled member/);
});

test("dissolving an arc returns its members to the top level", () => {
  let doc = createArc(fiveProps(), [prop("p1"), prop("p2")], "G");
  doc = dissolveArc(doc, "a1");
  expect(doc.arcs).toEqual([]);
  expect(doc.status).toBe("split");
  expect(validateDoc(doc)).toEqual([]);
});

test("dissolving a nested arc dissolves the arcs above it too", () => {
  let doc = createArc(fiveProps(), [prop("p1"), prop("p2")], "NegPos");
  doc = createArc(doc, [arc("a1"), prop("p3")], "G");
  expect(arcsDissolvedByDissolve(doc, "a1")).toEqual(["a1", "a2"]);
  expect(dissolveArc(doc, "a1").arcs).toEqual([]);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/core/arcTree.test.ts`
Expected: FAIL, "Failed to resolve import ./arcTree".

- [ ] **Step 3: Write `src/core/arcTree.ts`**

```ts
import { relationship, type RelCode } from "./relationships";
import { deriveStatus } from "./status";
import { ancestorsOfArc, memberKey, propIndexRange, topLevelUnits } from "./tree";
import type { ArcDoc, ArcNode, Member } from "./types";

export interface Fit {
  ok: boolean;
  /** Shown on the disabled palette row. */
  reason?: string;
}

/** Selected units must all be top level, adjacent, with no gap between them. */
export function unitsAreAdjacentTopLevel(doc: ArcDoc, units: Member[]): boolean {
  const top = topLevelUnits(doc).map(memberKey);
  if (!units.every((u) => top.includes(memberKey(u)))) return false;
  const positions = units.map((u) => top.indexOf(memberKey(u))).sort((a, b) => a - b);
  return positions.every((p, i) => i === 0 || p === positions[i - 1] + 1);
}

export function canRelate(doc: ArcDoc, units: Member[], code: RelCode): Fit {
  if (units.length < 2) return { ok: false, reason: "Select two or more neighbours" };
  if (!unitsAreAdjacentTopLevel(doc, units)) return { ok: false, reason: "Select neighbours" };

  const rel = relationship(code);
  if (rel.maxMembers === null) {
    return units.length >= rel.minMembers ? { ok: true } : { ok: false, reason: `Takes ${rel.minMembers} or more` };
  }
  if (units.length !== rel.minMembers) return { ok: false, reason: `Takes exactly ${rel.minMembers}` };
  return { ok: true };
}

/** Never reuses an id, so a dissolved arc's id cannot come back on a new arc. */
export function nextArcId(doc: ArcDoc): string {
  const used = doc.arcs.map((a) => Number(a.id.slice(1))).filter((n) => Number.isFinite(n));
  return `a${Math.max(0, ...used) + 1}`;
}

function inPassageOrder(doc: ArcDoc, units: Member[]): Member[] {
  return [...units].sort((a, b) => propIndexRange(doc, a).first - propIndexRange(doc, b).first);
}

function withStatus(doc: ArcDoc, arcs: ArcNode[]): ArcDoc {
  const next: ArcDoc = { ...doc, arcs };
  return { ...next, status: deriveStatus(next) };
}

export function createArc(doc: ArcDoc, units: Member[], code: RelCode): ArcDoc {
  const fit = canRelate(doc, units, code);
  if (!fit.ok) throw new Error(fit.reason ?? "these units cannot be related");
  const node: ArcNode = {
    id: nextArcId(doc),
    kind: "arc",
    rel: code,
    circled: null,
    members: inPassageOrder(doc, units),
  };
  return withStatus(doc, [...doc.arcs, node]);
}

export function relabelArc(doc: ArcDoc, arcId: string, code: RelCode): ArcDoc {
  const target = doc.arcs.find((a) => a.id === arcId);
  if (!target) throw new Error(`unknown arc ${arcId}`);
  const rel = relationship(code);
  const n = target.members.length;
  const okCount = rel.maxMembers === null ? n >= rel.minMembers : n === rel.minMembers;
  if (!okCount) {
    const want = rel.maxMembers === null ? `Takes ${rel.minMembers} or more` : `Takes exactly ${rel.minMembers}`;
    throw new Error(want);
  }
  const circled = rel.requiresCircle && target.circled !== null && target.circled < n ? target.circled : null;
  return withStatus(doc, doc.arcs.map((a) => (a.id === arcId ? { ...a, rel: code, circled } : a)));
}

/**
 * The arc itself plus every arc above it. An ancestor cannot survive losing
 * a member, which is the same rule a split follows.
 */
export function arcsDissolvedByDissolve(doc: ArcDoc, arcId: string): string[] {
  const set = new Set([arcId, ...ancestorsOfArc(doc, arcId)]);
  return doc.arcs.filter((a) => set.has(a.id)).map((a) => a.id);
}

export function dissolveArc(doc: ArcDoc, arcId: string): ArcDoc {
  if (!doc.arcs.some((a) => a.id === arcId)) throw new Error(`unknown arc ${arcId}`);
  const going = new Set(arcsDissolvedByDissolve(doc, arcId));
  return withStatus(doc, doc.arcs.filter((a) => !going.has(a.id)));
}

export function setCircled(doc: ArcDoc, arcId: string, memberIndex: number | null): ArcDoc {
  const target = doc.arcs.find((a) => a.id === arcId);
  if (!target) throw new Error(`unknown arc ${arcId}`);
  const rel = relationship(target.rel);
  if (!rel.requiresCircle) throw new Error(`${rel.name} does not take a circled member`);
  if (memberIndex !== null && (memberIndex < 0 || memberIndex >= target.members.length)) {
    throw new Error(`member index ${memberIndex} is out of range`);
  }
  return withStatus(doc, doc.arcs.map((a) => (a.id === arcId ? { ...a, circled: memberIndex } : a)));
}
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `npx vitest run src/core/arcTree.test.ts`
Expected: PASS, 15 tests.

- [ ] **Step 5: Run the gate and commit**

```bash
npm run gate
git add src/core/arcTree.ts src/core/arcTree.test.ts
git commit -m "feat: create, relabel, dissolve and circle arcs"
```

---

### Task 7: The stacked layout and Piper's Romans fixture

The geometry authority is `mockups/arcing-layouts.html` section A. Every constant below was read off that SVG, and the test asserts the exact path strings it draws.

**Files:**
- Create: `src/core/layout.ts`, `src/fixtures/piperRomans.ts`
- Test: `src/core/layout.test.ts`

**Interfaces:**
- Consumes: `topLevelUnits`, `propIndexRange`, `unitLevel` from `src/core/tree.ts`; `relationship` from `src/core/relationships.ts`; `splitAt` from `src/core/split.ts`; `createArc`, `setCircled` from `src/core/arcTree.ts`; `newArcDoc` from `src/core/doc.ts`.
- Produces:
  - `type LayoutMode = "stacked"`
  - `interface PropBox { id: string; x: number; y: number; w: number; h: number; lines: string[] }`
  - `interface ArcCircle { memberIndex: number; x: number; y: number }`
  - `interface ArcShape { id: string; d: string; sym: string; labelX: number; labelY: number; circles: ArcCircle[] }`
  - `interface LeafShape { propId: string; d: string }`
  - `interface Baseline { x: number; y0: number; y1: number; ticks: number[] }`
  - `interface Geometry { width: number; height: number; props: PropBox[]; arcs: ArcShape[]; leaves: LeafShape[]; baseline: Baseline }`
  - `const LAYOUT` (the constants, exported so the SVG component can place text baselines and the number gutter without doing geometry of its own)
  - `function wrapLines(text: string, maxChars: number): string[]`
  - `function layout(doc: ArcDoc, mode: LayoutMode): Geometry`
  - `src/fixtures/piperRomans.ts`: `PIPER_ROMANS_REFERENCE`, `PIPER_ROMANS_TEXT`, `PIPER_SPLIT_WORDS`, `piperRomansDoc(): ArcDoc`

- [ ] **Step 1: Write the fixture**

`src/fixtures/piperRomans.ts`:

```ts
// John Piper's own arc of Romans 12:1-2 from Biblical Exegesis, pp. 21-23:
// his four propositions, his labels, his circles. This is the ONLY sanctioned
// sample passage. Never use Ephesians in a fixture; that is Drew's own
// weekly series and an app-generated arc of it would pollute the practice.
//
// The diagram on p. 23 reads: Pu circled over 1, a stroke over 2a, + over 2b,
// Pu circled over 2c, Ac in the arc over 2a-2b, Ac in the arc over 2a-2c, no
// symbol on the outer arc. In this app's data model that is three arcs:
// NegPos(2a, 2b), then AcPur(that, 2c) with 2c circled, then AcPur(1, that)
// with 1 circled.
import { createArc, setCircled } from "@/core/arcTree";
import { newArcDoc } from "@/core/doc";
import { splitAt } from "@/core/split";
import type { ArcDoc } from "@/core/types";

export const PIPER_ROMANS_REFERENCE = "Romans 12:1-2";

export const PIPER_ROMANS_TEXT =
  "I beseech you by the mercies of God, brothers, to present your bodies to God as a living, holy, acceptable sacrifice which is your spiritual service of worship. And do not be conformed to this age but be transformed by the renewing of your mind, in order that you might approve what the will of God is, namely, the good, the acceptable, and the perfect.";

/** The first word of propositions 2, 3 and 4, used to find the split points. */
export const PIPER_SPLIT_WORDS = ["And do not", "but be transformed", "in order that"] as const;

export function piperRomansDoc(): ArcDoc {
  let doc = newArcDoc({
    id: "2026-09-05-romans-12-1-2",
    reference: PIPER_ROMANS_REFERENCE,
    canonical: PIPER_ROMANS_REFERENCE,
    source: "paste",
    text: PIPER_ROMANS_TEXT,
    verses: [],
    now: new Date("2026-09-05T15:00:00Z"),
  });

  for (const phrase of PIPER_SPLIT_WORDS) {
    doc = splitAt(doc, doc.passage.text.indexOf(phrase));
  }

  doc = createArc(doc, [{ kind: "prop", ref: "p2" }, { kind: "prop", ref: "p3" }], "NegPos");
  doc = createArc(doc, [{ kind: "arc", ref: "a1" }, { kind: "prop", ref: "p4" }], "AcPur");
  doc = setCircled(doc, "a2", 1);
  doc = createArc(doc, [{ kind: "prop", ref: "p1" }, { kind: "arc", ref: "a2" }], "AcPur");
  doc = setCircled(doc, "a3", 0);
  return doc;
}
```

- [ ] **Step 2: Write the failing test**

`src/core/layout.test.ts`:

```ts
import { expect, test } from "vitest";
import { piperRomansDoc } from "@/fixtures/piperRomans";
import { layout, wrapLines } from "./layout";
import { NEG_POS_SYMBOL } from "./relationships";
import { validateDoc } from "./validate";

test("the fixture is Piper's four propositions and three arcs, and it is valid", () => {
  const doc = piperRomansDoc();
  expect(doc.propositions.map((p) => p.text)).toEqual([
    "I beseech you by the mercies of God, brothers, to present your bodies to God as a living, holy, acceptable sacrifice which is your spiritual service of worship.",
    "And do not be conformed to this age",
    "but be transformed by the renewing of your mind,",
    "in order that you might approve what the will of God is, namely, the good, the acceptable, and the perfect.",
  ]);
  expect(doc.arcs.map((a) => [a.id, a.rel, a.circled])).toEqual([
    ["a1", "NegPos", null],
    ["a2", "AcPur", 1],
    ["a3", "AcPur", 0],
  ]);
  expect(validateDoc(doc)).toEqual([]);
});

test("wrapping is greedy at the character budget and never splits a word", () => {
  expect(wrapLines("I beseech you by the mercies of God, brothers, to present your bodies", 58)).toEqual([
    "I beseech you by the mercies of God, brothers, to present",
    "your bodies",
  ]);
  expect(wrapLines("supercalifragilistic", 5)).toEqual(["supercalifragilistic"]);
  expect(wrapLines("", 58)).toEqual([""]);
});

test("proposition rows are the mockup's boxes", () => {
  const g = layout(piperRomansDoc(), "stacked");
  expect(g.width).toBe(1024);
  expect(g.height).toBe(300);
  expect(g.props.map((p) => [p.id, p.y, p.h, p.lines.length])).toEqual([
    ["p1", 16, 96, 3],
    ["p2", 112, 48, 1],
    ["p3", 160, 48, 1],
    ["p4", 208, 72, 2],
  ]);
  expect(g.props[0].x).toBe(84);
  expect(g.props[0].w).toBe(528);
  expect(g.props[0].lines[0]).toBe("I beseech you by the mercies of God, brothers, to present");
});

test("proposition boxes never overlap", () => {
  const g = layout(piperRomansDoc(), "stacked");
  for (let i = 1; i < g.props.length; i += 1) {
    expect(g.props[i].y).toBe(g.props[i - 1].y + g.props[i - 1].h);
  }
});

test("the baseline runs the height of the stack with a tick at every boundary", () => {
  const g = layout(piperRomansDoc(), "stacked");
  expect(g.baseline).toEqual({ x: 612, y0: 16, y1: 280, ticks: [16, 112, 160, 208, 280] });
});

test("one leaf arc per proposition, at the innermost lane", () => {
  const g = layout(piperRomansDoc(), "stacked");
  expect(g.leaves).toEqual([
    { propId: "p1", d: "M612 16 A48 48 0 0 1 612 112" },
    { propId: "p2", d: "M612 112 A48 24 0 0 1 612 160" },
    { propId: "p3", d: "M612 160 A48 24 0 0 1 612 208" },
    { propId: "p4", d: "M612 208 A48 36 0 0 1 612 280" },
  ]);
});

test("one path per arc, one lane further out per nesting level", () => {
  const g = layout(piperRomansDoc(), "stacked");
  expect(g.arcs.map((a) => a.d)).toEqual([
    "M612 112 A104 48 0 0 1 612 208",
    "M612 112 A160 84 0 0 1 612 280",
    "M612 16 A216 132 0 0 1 612 280",
  ]);
});

test("each arc's symbol sits in its own lane at its vertical midpoint", () => {
  const g = layout(piperRomansDoc(), "stacked");
  expect(g.arcs.map((a) => [a.id, a.sym, a.labelX, a.labelY])).toEqual([
    ["a1", NEG_POS_SYMBOL, 690, 166],
    ["a2", "Ac/Pur", 746, 202],
    ["a3", "Ac/Pur", 802, 154],
  ]);
});

test("circle targets sit on each member, in that member's own lane", () => {
  const g = layout(piperRomansDoc(), "stacked");
  expect(g.arcs[0].circles).toEqual([]);
  expect(g.arcs[1].circles).toEqual([
    { memberIndex: 0, x: 690, y: 160 },
    { memberIndex: 1, x: 638, y: 244 },
  ]);
  expect(g.arcs[2].circles).toEqual([
    { memberIndex: 0, x: 638, y: 64 },
    { memberIndex: 1, x: 746, y: 196 },
  ]);
});

test("an unrelated document still lays out its propositions", () => {
  const doc = piperRomansDoc();
  const g = layout({ ...doc, arcs: [], status: "split" }, "stacked");
  expect(g.arcs).toEqual([]);
  expect(g.leaves).toHaveLength(4);
  expect(g.height).toBe(300);
});

test("an unknown mode throws rather than drawing something wrong", () => {
  // @ts-expect-error only the stacked mode exists in v1
  expect(() => layout(piperRomansDoc(), "biblearc")).toThrow(/unknown layout mode/);
});
```

- [ ] **Step 3: Run it and watch it fail**

Run: `npx vitest run src/core/layout.test.ts`
Expected: FAIL, "Failed to resolve import ./layout".

- [ ] **Step 4: Write `src/core/layout.ts`**

```ts
import { relationship } from "./relationships";
import { propIndexRange, unitLevel } from "./tree";
import type { ArcDoc, Member } from "./types";

/**
 * Only the paper-style stacked layout exists in v1 (RULED 2026-09-05 11:55).
 * The biblearc mode stays specified in the design doc and is a second branch
 * behind this same signature when it is ruled in.
 */
export type LayoutMode = "stacked";

export interface PropBox {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  lines: string[];
}

export interface ArcCircle {
  memberIndex: number;
  x: number;
  y: number;
}

export interface ArcShape {
  id: string;
  d: string;
  sym: string;
  labelX: number;
  labelY: number;
  circles: ArcCircle[];
}

/** Piper draws an arc over every proposition, not only over relationships. */
export interface LeafShape {
  propId: string;
  d: string;
}

export interface Baseline {
  x: number;
  y0: number;
  y1: number;
  ticks: number[];
}

export interface Geometry {
  width: number;
  height: number;
  props: PropBox[];
  arcs: ArcShape[];
  leaves: LeafShape[];
  baseline: Baseline;
}

/**
 * Read off mockups/arcing-layouts.html section A, which is the geometry
 * authority. MAX_CHARS 58 is what reproduces that mockup's exact line breaks
 * at 17 px in a 528 px column.
 */
export const LAYOUT = {
  WIDTH: 1024,
  /** Right edge of the proposition-number gutter. */
  NUMBER_X: 68,
  TEXT_X: 84,
  BASELINE_X: 612,
  TOP: 16,
  LINE_HEIGHT: 24,
  ROW_PAD: 24,
  /** First text baseline, measured down from the row's top edge. */
  FIRST_BASELINE: 30,
  MAX_CHARS: 58,
  LEAF_RX: 48,
  LANE_STEP: 56,
  LABEL_LANE_0: 26,
  LABEL_LANE_1: 78,
  /** Text baselines sit 6 px below the point they label. */
  LABEL_BASELINE: 6,
  TICK: 14,
  BOTTOM_PAD: 20,
} as const;

/** Greedy wrap. A word longer than the budget gets its own line uncut. */
export function wrapLines(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if (line === "") {
      line = word;
    } else if (line.length + 1 + word.length <= maxChars) {
      line = `${line} ${word}`;
    } else {
      lines.push(line);
      line = word;
    }
  }
  lines.push(line);
  return lines;
}

function arcPath(y0: number, y1: number, rx: number): string {
  return `M${LAYOUT.BASELINE_X} ${y0} A${rx} ${(y1 - y0) / 2} 0 0 1 ${LAYOUT.BASELINE_X} ${y1}`;
}

function rxFor(level: number): number {
  return LAYOUT.LEAF_RX + LAYOUT.LANE_STEP * level;
}

/**
 * Where a unit's own lettering sits: inside its own arc's bulge, clear of
 * every smaller arc. Level 0 is the leaf lane.
 */
function laneOffset(level: number): number {
  return level === 0 ? LAYOUT.LABEL_LANE_0 : LAYOUT.LABEL_LANE_1 + LAYOUT.LANE_STEP * (level - 1);
}

export function layout(doc: ArcDoc, mode: LayoutMode): Geometry {
  if (mode !== "stacked") throw new Error(`unknown layout mode: ${mode}`);

  const props: PropBox[] = [];
  let y = LAYOUT.TOP;
  for (const p of doc.propositions) {
    const lines = wrapLines(p.text, LAYOUT.MAX_CHARS);
    const h = lines.length * LAYOUT.LINE_HEIGHT + LAYOUT.ROW_PAD;
    props.push({ id: p.id, x: LAYOUT.TEXT_X, y, w: LAYOUT.BASELINE_X - LAYOUT.TEXT_X, h, lines });
    y += h;
  }

  const bottom = props.length > 0 ? props[props.length - 1].y + props[props.length - 1].h : LAYOUT.TOP;

  const spanOf = (unit: Member): { y0: number; y1: number } => {
    const range = propIndexRange(doc, unit);
    const first = props[range.first];
    const last = props[range.last];
    if (!first || !last) return { y0: LAYOUT.TOP, y1: LAYOUT.TOP };
    return { y0: first.y, y1: last.y + last.h };
  };

  const leaves: LeafShape[] = props.map((b) => ({
    propId: b.id,
    d: arcPath(b.y, b.y + b.h, LAYOUT.LEAF_RX),
  }));

  const arcs: ArcShape[] = doc.arcs.map((a) => {
    const unit: Member = { kind: "arc", ref: a.id };
    const level = unitLevel(doc, unit);
    const { y0, y1 } = spanOf(unit);
    const rel = relationship(a.rel);
    return {
      id: a.id,
      d: arcPath(y0, y1, rxFor(level)),
      sym: rel.symbol,
      labelX: LAYOUT.BASELINE_X + laneOffset(level),
      labelY: (y0 + y1) / 2 + LAYOUT.LABEL_BASELINE,
      circles: rel.requiresCircle
        ? a.members.map((m, memberIndex) => {
            const span = spanOf(m);
            return {
              memberIndex,
              x: LAYOUT.BASELINE_X + laneOffset(unitLevel(doc, m)),
              y: (span.y0 + span.y1) / 2,
            };
          })
        : [],
    };
  });

  return {
    width: LAYOUT.WIDTH,
    height: bottom + LAYOUT.BOTTOM_PAD,
    props,
    arcs,
    leaves,
    baseline: { x: LAYOUT.BASELINE_X, y0: LAYOUT.TOP, y1: bottom, ticks: [LAYOUT.TOP, ...props.map((b) => b.y + b.h)] },
  };
}
```

- [ ] **Step 5: Run the test and watch it pass**

Run: `npx vitest run src/core/layout.test.ts`
Expected: PASS, 10 tests. If a path string differs, the constants are wrong, not the test: re-read section A of `mockups/arcing-layouts.html`.

- [ ] **Step 6: Run the gate and commit**

```bash
npm run gate
git add src/core/layout.ts src/core/layout.test.ts src/fixtures/piperRomans.ts
git commit -m "feat: stacked layout geometry matching the paper-style mockup"
```

---

### Task 8: Password, session cookie and the login limiter

**Files:**
- Create: `src/server/session.ts`, `src/server/rateLimit.ts`, `scripts/hashPassword.ts`
- Test: `src/server/session.test.ts`, `src/server/rateLimit.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `SESSION_COOKIE = "app_session"`, `SESSION_MAX_AGE_S = 2592000`
  - `hashPassword(password: string): string` producing `scrypt$<saltHex>$<keyHex>`
  - `verifyPassword(password: string, stored: string): boolean`
  - `signSession(expiresAtMs: number, secret: string): string`
  - `verifySession(token: string, secret: string, nowMs: number): boolean`
  - `sessionSetCookie(token: string): string`, `sessionClearCookie(): string` (both drop `Secure` only under the dev-only e2e gate)
  - `readCookie(req: Request, name: string): string | null`
  - `hasValidSession(req: Request, nowMs?: number): boolean`
  - `passwordAccepted(password: string): boolean`
  - `isE2eAuthActive(): boolean`, `E2E_PASSWORD = "e2e-password"`
  - `createRateLimiter(limit: number, windowMs: number)`, `loginLimiter`, `clientIp(req: Request): string`

- [ ] **Step 1: Write the failing test for the session**

`src/server/session.test.ts`:

```ts
import { afterEach, beforeEach, expect, test } from "vitest";
import {
  E2E_PASSWORD,
  hasValidSession,
  hashPassword,
  passwordAccepted,
  readCookie,
  SESSION_COOKIE,
  sessionClearCookie,
  sessionSetCookie,
  signSession,
  verifyPassword,
  verifySession,
} from "./session";

const SECRET = "test-secret";
const env = { ...process.env };

beforeEach(() => {
  delete process.env.APP_E2E_AUTH;
  delete process.env.APP_PASSWORD_HASH;
  process.env.SESSION_SECRET = SECRET;
});

afterEach(() => {
  process.env = { ...env };
});

test("a hashed password verifies and a wrong one does not", () => {
  const stored = hashPassword("open sesame");
  expect(stored.startsWith("scrypt$")).toBe(true);
  expect(verifyPassword("open sesame", stored)).toBe(true);
  expect(verifyPassword("open sesamf", stored)).toBe(false);
});

test("two hashes of the same password differ because the salt differs", () => {
  expect(hashPassword("a")).not.toBe(hashPassword("a"));
});

test("a malformed stored hash verifies nothing", () => {
  expect(verifyPassword("a", "not-a-hash")).toBe(false);
});

test("a signed session verifies before its expiry and not after", () => {
  const token = signSession(1000, SECRET);
  expect(verifySession(token, SECRET, 999)).toBe(true);
  expect(verifySession(token, SECRET, 1001)).toBe(false);
});

test("a session signed with another secret does not verify", () => {
  expect(verifySession(signSession(1000, "other"), SECRET, 1)).toBe(false);
});

test("a tampered expiry does not verify", () => {
  const token = signSession(1000, SECRET);
  const tampered = `9999999${token.slice(token.indexOf("."))}`;
  expect(verifySession(tampered, SECRET, 1001)).toBe(false);
});

test("the cookie is httpOnly, Secure, SameSite Lax and 30 days long", () => {
  const header = sessionSetCookie("abc");
  expect(header).toContain(`${SESSION_COOKIE}=abc`);
  expect(header).toContain("HttpOnly");
  expect(header).toContain("Secure");
  expect(header).toContain("SameSite=Lax");
  expect(header).toContain("Max-Age=2592000");
  expect(header).toContain("Path=/");
  expect(sessionClearCookie()).toContain("Max-Age=0");
});

test("the dev-only e2e gate drops Secure so http localhost can hold the cookie", () => {
  process.env.APP_E2E_AUTH = "1";
  process.env.NODE_ENV = "development";
  expect(sessionSetCookie("abc")).not.toContain("Secure");
  expect(sessionSetCookie("abc")).toContain("HttpOnly");
});

test("a cookie is read out of a request by name", () => {
  const req = new Request("https://x.test/", { headers: { cookie: "other=1; app_session=abc" } });
  expect(readCookie(req, SESSION_COOKIE)).toBe("abc");
  expect(readCookie(req, "missing")).toBeNull();
});

test("a request carrying a live cookie has a valid session", () => {
  const token = signSession(Date.now() + 1000, SECRET);
  const req = new Request("https://x.test/", { headers: { cookie: `${SESSION_COOKIE}=${token}` } });
  expect(hasValidSession(req)).toBe(true);
  expect(hasValidSession(new Request("https://x.test/"))).toBe(false);
});

test("the password is checked against the environment hash", () => {
  process.env.APP_PASSWORD_HASH = hashPassword("real");
  expect(passwordAccepted("real")).toBe(true);
  expect(passwordAccepted("fake")).toBe(false);
});

test("the e2e bypass accepts only the fixed password and only in development", () => {
  process.env.APP_E2E_AUTH = "1";
  process.env.NODE_ENV = "development";
  expect(passwordAccepted(E2E_PASSWORD)).toBe(true);
  expect(passwordAccepted("anything else")).toBe(false);

  process.env.NODE_ENV = "production";
  expect(passwordAccepted(E2E_PASSWORD)).toBe(false);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/server/session.test.ts`
Expected: FAIL, "Failed to resolve import ./session".

- [ ] **Step 3: Write `src/server/session.ts`**

```ts
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "app_session";
export const SESSION_MAX_AGE_S = 60 * 60 * 24 * 30;

const KEY_LENGTH = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const key = scryptSync(password, salt, KEY_LENGTH);
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  try {
    const salt = Buffer.from(parts[1], "hex");
    const expected = Buffer.from(parts[2], "hex");
    if (expected.length !== KEY_LENGTH) return false;
    const actual = scryptSync(password, salt, KEY_LENGTH);
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

/** The cookie value: an expiry, and an HMAC over that expiry. */
export function signSession(expiresAtMs: number, secret: string): string {
  const payload = String(Math.floor(expiresAtMs));
  const mac = createHmac("sha256", secret).update(payload).digest("hex");
  return `${payload}.${mac}`;
}

export function verifySession(token: string, secret: string, nowMs: number): boolean {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return false;
  const payload = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  if (mac.length !== expected.length) return false;
  if (!timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return false;
  const expiry = Number(payload);
  return Number.isFinite(expiry) && nowMs < expiry;
}

/**
 * Secure everywhere except under the dev-only e2e gate: Playwright drives
 * http://localhost, and WebKit (the iPad project) refuses a Secure cookie
 * over http. The exemption rides on the same double gate as the password
 * bypass, so the standalone build can never take it.
 */
function secureAttr(): string {
  return isE2eAuthActive() ? "" : " Secure;";
}

export function sessionSetCookie(token: string): string {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly;${secureAttr()} SameSite=Lax; Max-Age=${SESSION_MAX_AGE_S}`;
}

export function sessionClearCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly;${secureAttr()} SameSite=Lax; Max-Age=0`;
}

export function readCookie(req: Request, name: string): string | null {
  const header = req.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return null;
}

export function hasValidSession(req: Request, nowMs: number = Date.now()): boolean {
  const secret = process.env.SESSION_SECRET;
  if (!secret) return false;
  const token = readCookie(req, SESSION_COOKIE);
  return token !== null && verifySession(token, secret, nowMs);
}

/**
 * Dev-only Playwright bypass. It replaces the password HASH, nothing else:
 * the login route, the cookie and every guard still run exactly as they do
 * in production. Double gated on NODE_ENV so the standalone build (which
 * pins NODE_ENV to production) can never take this branch.
 */
export const E2E_PASSWORD = "e2e-password";

export function isE2eAuthActive(): boolean {
  return process.env.APP_E2E_AUTH === "1" && process.env.NODE_ENV === "development";
}

export function passwordAccepted(password: string): boolean {
  if (isE2eAuthActive()) return password === E2E_PASSWORD;
  const stored = process.env.APP_PASSWORD_HASH;
  return typeof stored === "string" && stored.length > 0 && verifyPassword(password, stored);
}
```

- [ ] **Step 4: Run the session test and watch it pass**

Run: `npx vitest run src/server/session.test.ts`
Expected: PASS, 11 tests.

- [ ] **Step 5: Write the failing test for the limiter**

`src/server/rateLimit.test.ts`:

```ts
import { expect, test } from "vitest";
import { clientIp, createRateLimiter } from "./rateLimit";

test("the sixth attempt in a minute is refused", () => {
  const limiter = createRateLimiter(5, 60_000);
  for (let i = 0; i < 5; i += 1) expect(limiter.allow("1.2.3.4", 1000)).toBe(true);
  expect(limiter.allow("1.2.3.4", 1000)).toBe(false);
});

test("the window slides, so attempts are allowed again a minute later", () => {
  const limiter = createRateLimiter(5, 60_000);
  for (let i = 0; i < 5; i += 1) limiter.allow("1.2.3.4", 1000);
  expect(limiter.allow("1.2.3.4", 61_001)).toBe(true);
});

test("one address being refused does not refuse another", () => {
  const limiter = createRateLimiter(5, 60_000);
  for (let i = 0; i < 6; i += 1) limiter.allow("1.2.3.4", 1000);
  expect(limiter.allow("5.6.7.8", 1000)).toBe(true);
});

test("the client address is the first hop of x-forwarded-for", () => {
  const req = new Request("https://x.test/", { headers: { "x-forwarded-for": "9.9.9.9, 10.0.0.1" } });
  expect(clientIp(req)).toBe("9.9.9.9");
  expect(clientIp(new Request("https://x.test/"))).toBe("unknown");
});
```

- [ ] **Step 6: Run it, watch it fail, then write `src/server/rateLimit.ts`**

Run: `npx vitest run src/server/rateLimit.test.ts`
Expected: FAIL, "Failed to resolve import ./rateLimit".

```ts
export interface RateLimiter {
  allow(key: string, nowMs?: number): boolean;
}

/**
 * In-memory sliding window. One process, one user, so there is nothing to
 * share and nothing to persist; a restart forgiving five attempts is fine.
 */
export function createRateLimiter(limit: number, windowMs: number): RateLimiter {
  const hits = new Map<string, number[]>();
  return {
    allow(key: string, nowMs: number = Date.now()): boolean {
      const recent = (hits.get(key) ?? []).filter((t) => nowMs - t < windowMs);
      if (recent.length >= limit) {
        hits.set(key, recent);
        return false;
      }
      recent.push(nowMs);
      hits.set(key, recent);
      return true;
    },
  };
}

/** 5 tries a minute per IP, then 429. */
export const loginLimiter = createRateLimiter(5, 60_000);

export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (!forwarded) return "unknown";
  return forwarded.split(",")[0].trim() || "unknown";
}
```

Run: `npx vitest run src/server/rateLimit.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 7: Write the hash-password script**

`scripts/hashPassword.ts`:

```ts
// Usage: npm run hash-password
// Reads one line from stdin so the password never lands in shell history,
// prints the value to paste into APP_PASSWORD_HASH.
import { createInterface } from "node:readline/promises";
import { hashPassword } from "../src/server/session";

async function main(): Promise<void> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const password = await rl.question("Password: ");
  rl.close();
  if (!password) {
    console.error("no password given");
    process.exitCode = 1;
    return;
  }
  console.log(hashPassword(password));
}

void main();
```

Verify by hand:

```bash
printf 'hunter2\n' | npm run --silent hash-password
```

Expected: one line starting `scrypt$`.

- [ ] **Step 8: Run the gate and commit**

```bash
npm run gate
git add src/server/session.ts src/server/rateLimit.ts src/server/session.test.ts src/server/rateLimit.test.ts scripts/hashPassword.ts
git commit -m "feat: password hashing, signed session cookie, and login rate limit"
```

---

### Task 9: The ESV client and the verse-marker parser

**Files:**
- Create: `src/server/esv.ts`
- Test: `src/server/esv.test.ts`

**Interfaces:**
- Consumes: `Verse` from `src/core/types.ts`.
- Produces:
  - `class EsvUnavailableError extends Error`
  - `const ESV_PARAMS: Record<string, string>`
  - `interface EsvPassage { canonical: string; text: string; verses: Verse[] }`
  - `parsePassage(canonical: string, raw: string): EsvPassage`
  - `fetchPassage(reference: string, opts?: { fetchImpl?: typeof fetch; apiKey?: string; timeoutMs?: number }): Promise<EsvPassage>`

- [ ] **Step 1: Write the failing test**

`src/server/esv.test.ts`:

```ts
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
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/server/esv.test.ts`
Expected: FAIL, "Failed to resolve import ./esv".

- [ ] **Step 3: Write `src/server/esv.ts`**

```ts
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
 * Strip the inline [n] markers, collapse whitespace, and record where each
 * verse begins in the cleaned text. That cleaned text is the only copy this
 * app stores, so the indices here are the ones propositions tile against.
 */
export function parsePassage(canonical: string, raw: string): EsvPassage {
  const collapsed = raw.replace(/\s+/g, " ").trim();
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

  return { canonical, text: text.trim(), verses };
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
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `npx vitest run src/server/esv.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Run the gate and commit**

```bash
npm run gate
git add src/server/esv.ts src/server/esv.test.ts
git commit -m "feat: ESV passage fetch and inline verse marker parser"
```

---

### Task 10: The JSON file store

**Files:**
- Create: `src/server/arcStore.ts`
- Test: `src/server/arcStore.test.ts`

**Interfaces:**
- Consumes: `ArcDoc`, `ArcStatus` from `src/core/types.ts`.
- Produces:
  - `interface ArcSummary { id: string; reference: string; status: ArcStatus; createdAt: string; updatedAt: string; mainPoint: string }`
  - `arcsDir(): string`
  - `isSafeArcId(id: string): boolean`
  - `listArcIds(): Promise<string[]>`
  - `readArc(id: string): Promise<ArcDoc | null>`
  - `writeArc(doc: ArcDoc): Promise<void>`
  - `listSummaries(): Promise<ArcSummary[]>`

- [ ] **Step 1: Write the failing test**

`src/server/arcStore.test.ts`:

```ts
import { mkdtemp, readdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, test } from "vitest";
import { newArcDoc } from "@/core/doc";
import type { ArcDoc } from "@/core/types";
import { arcsDir, isSafeArcId, listArcIds, listSummaries, readArc, writeArc } from "./arcStore";

const previous = process.env.DATA_DIR;

beforeEach(async () => {
  process.env.DATA_DIR = await mkdtemp(path.join(tmpdir(), "arcing-store-"));
});

afterEach(() => {
  process.env.DATA_DIR = previous;
});

function doc(id: string, reference: string, createdAt: string): ArcDoc {
  const base = newArcDoc({
    id, reference, canonical: reference, source: "paste",
    text: "one two", verses: [], now: new Date(createdAt),
  });
  return base;
}

test("an unwritten arc reads back as null", async () => {
  expect(await readArc("2026-09-05-romans-12-1-2")).toBeNull();
});

test("a written arc reads back identical", async () => {
  const written = doc("2026-09-05-romans-12-1-2", "Romans 12:1-2", "2026-09-05T15:00:00Z");
  await writeArc(written);
  expect(await readArc(written.id)).toEqual(written);
});

test("arcs are stored pretty printed under arcs/", async () => {
  const written = doc("2026-09-05-romans-12-1-2", "Romans 12:1-2", "2026-09-05T15:00:00Z");
  await writeArc(written);
  const files = await readdir(arcsDir());
  expect(files).toEqual(["2026-09-05-romans-12-1-2.json"]);
  const raw = await readFile(path.join(arcsDir(), files[0]), "utf8");
  expect(raw).toContain('\n  "id"');
  expect(raw.endsWith("\n")).toBe(true);
});

test("writing leaves no temporary file behind", async () => {
  await writeArc(doc("a-1", "Romans 12:1", "2026-09-05T15:00:00Z"));
  const files = await readdir(arcsDir());
  expect(files.every((f) => f.endsWith(".json"))).toBe(true);
});

test("a rewrite replaces the file rather than appending", async () => {
  const first = doc("a-1", "Romans 12:1", "2026-09-05T15:00:00Z");
  await writeArc(first);
  await writeArc({ ...first, rev: 2, summary: { ...first.summary, mainPoint: "second" } });
  const stored = await readArc("a-1");
  expect(stored?.rev).toBe(2);
  expect(stored?.summary.mainPoint).toBe("second");
});

test("ids are listed and summaries come back newest first", async () => {
  await writeArc(doc("2026-09-01-a", "Romans 1:1", "2026-09-01T10:00:00Z"));
  const later = doc("2026-09-05-b", "Romans 12:1-2", "2026-09-05T10:00:00Z");
  await writeArc({ ...later, summary: { ...later.summary, mainPoint: "Present your bodies." } });

  expect((await listArcIds()).sort()).toEqual(["2026-09-01-a", "2026-09-05-b"]);
  const summaries = await listSummaries();
  expect(summaries.map((s) => s.id)).toEqual(["2026-09-05-b", "2026-09-01-a"]);
  expect(summaries[0]).toEqual({
    id: "2026-09-05-b",
    reference: "Romans 12:1-2",
    status: "split",
    createdAt: "2026-09-05T10:00:00.000Z",
    updatedAt: "2026-09-05T10:00:00.000Z",
    mainPoint: "Present your bodies.",
  });
});

test("an id that could escape the data directory is refused", async () => {
  expect(isSafeArcId("2026-09-05-romans-12-1-2")).toBe(true);
  expect(isSafeArcId("../../etc/passwd")).toBe(false);
  expect(isSafeArcId("a/b")).toBe(false);
  expect(isSafeArcId("A_B")).toBe(false);
  await expect(readArc("../../etc/passwd")).resolves.toBeNull();
  await expect(writeArc(doc("../evil", "Romans 1:1", "2026-09-05T10:00:00Z"))).rejects.toThrow(/unsafe arc id/);
});

test("a corrupt file is skipped rather than breaking the list", async () => {
  await writeArc(doc("a-1", "Romans 1:1", "2026-09-05T10:00:00Z"));
  const { writeFile } = await import("node:fs/promises");
  await writeFile(path.join(arcsDir(), "broken.json"), "{ not json", "utf8");
  const summaries = await listSummaries();
  expect(summaries.map((s) => s.id)).toEqual(["a-1"]);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/server/arcStore.test.ts`
Expected: FAIL, "Failed to resolve import ./arcStore".

- [ ] **Step 3: Write `src/server/arcStore.ts`**

```ts
import { mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ArcDoc, ArcStatus } from "@/core/types";

export interface ArcSummary {
  id: string;
  reference: string;
  status: ArcStatus;
  createdAt: string;
  updatedAt: string;
  mainPoint: string;
}

/** Read at call time, not at module load, so tests can point it at a tmpdir. */
export function arcsDir(): string {
  return path.join(process.env.DATA_DIR ?? "./data", "arcs");
}

/** Arc ids are generated from a date and a slug; nothing else is legal. */
export function isSafeArcId(id: string): boolean {
  return /^[a-z0-9][a-z0-9-]*$/.test(id);
}

export async function listArcIds(): Promise<string[]> {
  try {
    const files = await readdir(arcsDir());
    return files.filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -".json".length));
  } catch {
    return [];
  }
}

export async function readArc(id: string): Promise<ArcDoc | null> {
  if (!isSafeArcId(id)) return null;
  try {
    const raw = await readFile(path.join(arcsDir(), `${id}.json`), "utf8");
    return JSON.parse(raw) as ArcDoc;
  } catch {
    return null;
  }
}

/** Temp file then rename, so a crash mid-write cannot truncate an arc. */
export async function writeArc(doc: ArcDoc): Promise<void> {
  if (!isSafeArcId(doc.id)) throw new Error(`unsafe arc id: ${doc.id}`);
  const dir = arcsDir();
  await mkdir(dir, { recursive: true });
  const target = path.join(dir, `${doc.id}.json`);
  const temp = path.join(dir, `.${doc.id}.${process.pid}.tmp`);
  await writeFile(temp, `${JSON.stringify(doc, null, 2)}\n`, "utf8");
  await rename(temp, target);
}

export async function listSummaries(): Promise<ArcSummary[]> {
  const ids = await listArcIds();
  const docs = await Promise.all(ids.map((id) => readArc(id)));
  return docs
    .filter((d): d is ArcDoc => d !== null)
    .map((d) => ({
      id: d.id,
      reference: d.passage.reference,
      status: d.status,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
      mainPoint: d.summary.mainPoint,
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `npx vitest run src/server/arcStore.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Run the gate and commit**

```bash
npm run gate
git add src/server/arcStore.ts src/server/arcStore.test.ts
git commit -m "feat: JSON arc file store with atomic writes"
```

---

### Task 11: The API routes and route protection

**Files:**
- Create: `src/server/httpErrors.ts`, `src/server/routeGuard.ts`, `src/proxy.ts`, `src/app/api/login/route.ts`, `src/app/api/logout/route.ts`, `src/app/api/arcs/route.ts`, `src/app/api/arcs/[id]/route.ts`
- Test: `src/server/routeGuard.test.ts`, `src/server/routes.test.ts`

**Interfaces:**
- Consumes: `hasValidSession`, `passwordAccepted`, `sessionSetCookie`, `sessionClearCookie`, `signSession`, `SESSION_MAX_AGE_S` from `src/server/session.ts`; `loginLimiter`, `clientIp` from `src/server/rateLimit.ts`; `fetchPassage`, `EsvUnavailableError` from `src/server/esv.ts`; `listSummaries`, `listArcIds`, `readArc`, `writeArc` from `src/server/arcStore.ts`; `arcId`, `localDate`, `newArcDoc` from `src/core/doc.ts`; `deriveStatus` from `src/core/status.ts`; `validateDoc` from `src/core/validate.ts`.
- Produces:
  - `src/server/httpErrors.ts`: `unauthorized()`, `notFound()`, `badRequest(message)`, `tooManyRequests()`, `serviceUnavailable(error)`, `conflict(doc)`, `invalid(violations)`
  - `src/server/routeGuard.ts`: `type GuardDecision = "next" | "login"`, `guardDecision(pathname: string, signedIn: boolean): GuardDecision`, `PUBLIC_PATHS`
  - Route handlers: `POST /api/login`, `POST /api/logout`, `GET|POST /api/arcs`, `GET|PUT /api/arcs/:id`
  - Wire contract the client relies on: `GET /api/arcs` returns `ArcSummary[]`; `POST /api/arcs` returns the `ArcDoc` with status 201; `PUT /api/arcs/:id` returns the saved `ArcDoc`, or 409 `{ error: "conflict", doc }`, or 400 `{ error: "invalid", violations }`

- [ ] **Step 1: Write `src/server/httpErrors.ts`** (madori's file, extended with the three statuses this app adds)

```ts
// Small shared JSON error responses. Every route handler in src/app/api hits
// at least one of these, so one place keeps the status and body shape
// consistent instead of each handler inlining NextResponse.json calls.
import { NextResponse } from "next/server";
import type { Violation } from "@/core/validate";
import type { ArcDoc } from "@/core/types";

export function unauthorized(): NextResponse {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

export function notFound(): NextResponse {
  return NextResponse.json({ error: "not found" }, { status: 404 });
}

export function badRequest(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function tooManyRequests(): NextResponse {
  return NextResponse.json({ error: "too_many_requests" }, { status: 429 });
}

export function serviceUnavailable(error: string): NextResponse {
  return NextResponse.json({ error }, { status: 503 });
}

export function conflict(doc: ArcDoc): NextResponse {
  return NextResponse.json({ error: "conflict", doc }, { status: 409 });
}

export function invalid(violations: Violation[]): NextResponse {
  return NextResponse.json({ error: "invalid", violations }, { status: 400 });
}
```

- [ ] **Step 2: Write the failing test for the route guard**

`src/server/routeGuard.test.ts`:

```ts
import { expect, test } from "vitest";
import { guardDecision } from "./routeGuard";

test("the login page is reachable without a session", () => {
  expect(guardDecision("/login", false)).toBe("next");
});

test("api routes are passed through so they can answer 401 themselves", () => {
  expect(guardDecision("/api/arcs", false)).toBe("next");
  expect(guardDecision("/api/arcs/2026-09-05-romans-12-1-2", false)).toBe("next");
});

test("a page without a session goes to login", () => {
  expect(guardDecision("/", false)).toBe("login");
  expect(guardDecision("/a/2026-09-05-romans-12-1-2/split", false)).toBe("login");
});

test("a page with a session is served", () => {
  expect(guardDecision("/", true)).toBe("next");
});

test("a path that merely starts with login is not public", () => {
  expect(guardDecision("/loginish", false)).toBe("login");
});
```

Run: `npx vitest run src/server/routeGuard.test.ts`
Expected: FAIL, "Failed to resolve import ./routeGuard".

- [ ] **Step 3: Write `src/server/routeGuard.ts` and `src/proxy.ts`**

`src/server/routeGuard.ts`:

```ts
/**
 * The one place that decides what is reachable without a cookie. Kept out of
 * proxy.ts so it can be unit tested: importing proxy.ts into vitest drags in
 * next/server's request plumbing, which is not worth mocking for one branch.
 */
export type GuardDecision = "next" | "login";

export const PUBLIC_PATHS = ["/login"] as const;

export function guardDecision(pathname: string, signedIn: boolean): GuardDecision {
  if (PUBLIC_PATHS.includes(pathname as (typeof PUBLIC_PATHS)[number])) return "next";
  // API routes answer 401 on their own. Never mask an API status with a redirect.
  if (pathname === "/api" || pathname.startsWith("/api/")) return "next";
  return signedIn ? "next" : "login";
}
```

`src/proxy.ts`:

```ts
// Route protection. Next.js 16 deprecated the old `middleware.ts` file
// convention in favour of `proxy.ts`, and the rename is NOT cosmetic: under
// the old name Next 16 still compiles this file as EDGE runtime, which
// cannot load node:crypto, and src/server/session.ts needs it to verify the
// cookie HMAC. Only the `proxy.ts` name defaults to the Node.js runtime.
// This bit madori (memory/madori_project.md gotcha 8) and only a live
// request reveals it: `next build` bundles this file without executing it.
import { NextResponse, type NextRequest } from "next/server";
import { guardDecision } from "@/server/routeGuard";
import { hasValidSession } from "@/server/session";

export default function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const decision = guardDecision(pathname, hasValidSession(request));
  if (decision === "next") return NextResponse.next();
  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  // Anchored to the same boundaries guardDecision enforces. A matcher
  // excluded path never reaches the function above, so guardDecision cannot
  // reassert anything for it. Next requires a static literal here.
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico$|login$|api/).*)"],
};
```

Run: `npx vitest run src/server/routeGuard.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 4: Write the failing test for the routes**

`src/server/routes.test.ts`:

```ts
import { mkdtemp } from "node:fs/promises";
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
  process.env.DATA_DIR = await mkdtemp(path.join(tmpdir(), "arcing-routes-"));
});

afterEach(() => {
  vi.unstubAllGlobals();
  process.env = { ...envBefore };
});

async function createPasted(reference = "Romans 12:1-2", text = "one two three"): Promise<ArcDoc> {
  const res = await createArcRoute(
    signedIn("https://x.test/api/arcs", { method: "POST", body: JSON.stringify({ reference, text }) })
  );
  expect(res.status).toBe(201);
  return (await res.json()) as ArcDoc;
}

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
  expect(list).toEqual([]);
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
  const res = await putArc(
    signedIn(`https://x.test/api/arcs/${doc.id}`, { method: "PUT", body: JSON.stringify(edited) }),
    { params: Promise.resolve({ id: doc.id }) }
  );
  const saved = (await res.json()) as ArcDoc;
  expect(res.status).toBe(200);
  expect(saved.rev).toBe(2);
  expect(saved.summary.mainPoint).toBe("Present your bodies.");
  expect(saved.updatedAt >= doc.updatedAt).toBe(true);
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
```

Run: `npx vitest run src/server/routes.test.ts`
Expected: FAIL, "Failed to resolve import @/app/api/login/route".

- [ ] **Step 5: Write the four route files**

`src/app/api/login/route.ts`:

```ts
import { NextResponse } from "next/server";
import { tooManyRequests, unauthorized } from "@/server/httpErrors";
import { clientIp, loginLimiter } from "@/server/rateLimit";
import { SESSION_MAX_AGE_S, passwordAccepted, sessionSetCookie, signSession } from "@/server/session";

export async function POST(req: Request): Promise<Response> {
  if (!loginLimiter.allow(clientIp(req))) return tooManyRequests();

  let password = "";
  try {
    const body = (await req.json()) as { password?: unknown };
    password = typeof body.password === "string" ? body.password : "";
  } catch {
    return unauthorized();
  }

  if (!passwordAccepted(password)) return unauthorized();

  const secret = process.env.SESSION_SECRET;
  if (!secret) return unauthorized();

  const token = signSession(Date.now() + SESSION_MAX_AGE_S * 1000, secret);
  const res = NextResponse.json({ ok: true });
  res.headers.set("set-cookie", sessionSetCookie(token));
  return res;
}
```

`src/app/api/logout/route.ts`:

```ts
import { NextResponse } from "next/server";
import { sessionClearCookie } from "@/server/session";

export async function POST(): Promise<Response> {
  const res = NextResponse.json({ ok: true });
  res.headers.set("set-cookie", sessionClearCookie());
  return res;
}
```

`src/app/api/arcs/route.ts`:

```ts
import { NextResponse } from "next/server";
import { arcId, localDate, newArcDoc } from "@/core/doc";
import { validateDoc } from "@/core/validate";
import { listArcIds, listSummaries, writeArc } from "@/server/arcStore";
import { EsvUnavailableError, fetchPassage } from "@/server/esv";
import { badRequest, invalid, serviceUnavailable, unauthorized } from "@/server/httpErrors";
import { hasValidSession } from "@/server/session";

/** The box runs America/New_York; a Saturday-night arc is filed on Saturday. */
const ARC_TIMEZONE = "America/New_York";

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
```

`src/app/api/arcs/[id]/route.ts`:

```ts
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

export async function PUT(req: Request, ctx: Context): Promise<Response> {
  if (!hasValidSession(req)) return unauthorized();
  const { id } = await ctx.params;

  const stored = await readArc(id);
  if (!stored) return notFound();

  let body: ArcDoc;
  try {
    body = (await req.json()) as ArcDoc;
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
```

- [ ] **Step 6: Run the route tests and watch them pass**

Run: `npx vitest run src/server/routes.test.ts src/server/routeGuard.test.ts`
Expected: PASS, 20 tests.

- [ ] **Step 7: Run the gate, build, and commit**

```bash
npm run gate && npm run build
git add src/server/httpErrors.ts src/server/routeGuard.ts src/proxy.ts src/app/api src/server/routes.test.ts src/server/routeGuard.test.ts
git commit -m "feat: login, arcs and arc routes with conflict detection"
```

---

### Task 12: The client store and undo history

**Files:**
- Create: `src/client/store.ts`
- Test: `src/client/store.test.ts`

**Interfaces:**
- Consumes: `ArcDoc`, `Member` from `src/core/types.ts`.
- Produces:
  - `type SaveState = "saved" | "saving" | "unsaved" | "offline" | "conflict"`
  - `const UNDO_LIMIT = 200`
  - `useArcStore` with state `{ doc, saveState, selection, conflictDoc }` and actions `loadArc(doc)`, `editDoc(doc)`, `leaveArc()`, `setSaveState(s)`, `setSelection(units)`, `setConflictDoc(doc | null)`
  - `undo()`, `redo()`, `clearHistory()`, `historyDepth()`, `canUndo()`, `canRedo()`

- [ ] **Step 1: Write the failing test**

`src/client/store.test.ts`:

```ts
import { beforeEach, expect, test } from "vitest";
import { newArcDoc } from "@/core/doc";
import { splitAt } from "@/core/split";
import type { ArcDoc } from "@/core/types";
import {
  canRedo,
  canUndo,
  clearHistory,
  historyDepth,
  redo,
  undo,
  UNDO_LIMIT,
  useArcStore,
} from "./store";

function fresh(): ArcDoc {
  return newArcDoc({
    id: "d", reference: "Romans 12:1-2", canonical: "Romans 12:1-2", source: "paste",
    text: "one two three four five", verses: [], now: new Date("2026-09-05T15:00:00Z"),
  });
}

beforeEach(() => {
  useArcStore.setState({ doc: null, saveState: "saved", selection: [], conflictDoc: null });
  clearHistory();
});

test("loading an arc starts with an empty history", () => {
  useArcStore.getState().loadArc(fresh());
  expect(useArcStore.getState().doc?.id).toBe("d");
  expect(historyDepth()).toBe(0);
  expect(canUndo()).toBe(false);
});

test("an edit is undoable and redoable", () => {
  useArcStore.getState().loadArc(fresh());
  useArcStore.getState().editDoc(splitAt(fresh(), 4));
  expect(useArcStore.getState().doc?.propositions).toHaveLength(2);

  undo();
  expect(useArcStore.getState().doc?.propositions).toHaveLength(1);
  expect(canRedo()).toBe(true);

  redo();
  expect(useArcStore.getState().doc?.propositions).toHaveLength(2);
});

test("save state and selection changes are not undo steps", () => {
  useArcStore.getState().loadArc(fresh());
  useArcStore.getState().setSaveState("saving");
  useArcStore.getState().setSelection([{ kind: "prop", ref: "p1" }]);
  expect(historyDepth()).toBe(0);
});

test("history is capped at 200 steps", () => {
  useArcStore.getState().loadArc(fresh());
  for (let i = 0; i < UNDO_LIMIT + 40; i += 1) {
    const doc = useArcStore.getState().doc as ArcDoc;
    useArcStore.getState().editDoc({ ...doc, summary: { ...doc.summary, mainPoint: `edit ${i}` } });
  }
  expect(historyDepth()).toBe(UNDO_LIMIT);
});

test("leaving the arc clears the document and the history", () => {
  useArcStore.getState().loadArc(fresh());
  useArcStore.getState().editDoc(splitAt(fresh(), 4));
  useArcStore.getState().leaveArc();
  expect(useArcStore.getState().doc).toBeNull();
  expect(historyDepth()).toBe(0);
  expect(canUndo()).toBe(false);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/client/store.test.ts`
Expected: FAIL, "Failed to resolve import ./store".

- [ ] **Step 3: Write `src/client/store.ts`**

```ts
import { temporal } from "zundo";
import { create } from "zustand";
import type { ArcDoc, Member } from "@/core/types";

export type SaveState = "saved" | "saving" | "unsaved" | "offline" | "conflict";

/** Every edit on all three screens is undoable, 200 steps deep. */
export const UNDO_LIMIT = 200;

interface ArcState {
  doc: ArcDoc | null;
  saveState: SaveState;
  selection: Member[];
  /** The server copy delivered by a 409, shown behind the conflict banner. */
  conflictDoc: ArcDoc | null;
  loadArc: (doc: ArcDoc) => void;
  editDoc: (doc: ArcDoc) => void;
  leaveArc: () => void;
  setSaveState: (state: SaveState) => void;
  setSelection: (selection: Member[]) => void;
  setConflictDoc: (doc: ArcDoc | null) => void;
}

export const useArcStore = create<ArcState>()(
  temporal(
    (set) => ({
      doc: null,
      saveState: "saved",
      selection: [],
      conflictDoc: null,
      loadArc: (doc) => {
        set({ doc, selection: [], conflictDoc: null, saveState: "saved" });
        clearHistory();
      },
      editDoc: (doc) => set({ doc }),
      leaveArc: () => {
        set({ doc: null, selection: [], conflictDoc: null, saveState: "saved" });
        clearHistory();
      },
      setSaveState: (saveState) => set({ saveState }),
      setSelection: (selection) => set({ selection }),
      setConflictDoc: (conflictDoc) => set({ conflictDoc }),
    }),
    {
      limit: UNDO_LIMIT,
      // Only the document is history. Save state, selection and the conflict
      // copy are view state; undoing them would be nonsense.
      partialize: (state) => ({ doc: state.doc }),
    }
  )
);

export function undo(): void {
  useArcStore.temporal.getState().undo();
}

export function redo(): void {
  useArcStore.temporal.getState().redo();
}

export function clearHistory(): void {
  useArcStore.temporal.getState().clear();
}

export function historyDepth(): number {
  return useArcStore.temporal.getState().pastStates.length;
}

export function canUndo(): boolean {
  return historyDepth() > 0;
}

export function canRedo(): boolean {
  return useArcStore.temporal.getState().futureStates.length > 0;
}
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `npx vitest run src/client/store.test.ts`
Expected: PASS, 5 tests. If `historyDepth()` reads 1 after `loadArc`, `clearHistory()` is being called before zundo records the set: move it into a `queueMicrotask` and re-run.

- [ ] **Step 5: Run the gate and commit**

```bash
npm run gate
git add src/client/store.ts src/client/store.test.ts
git commit -m "feat: arc store with 200 step undo history"
```

---

### Task 13: The API client and the autosave engine

**Files:**
- Create: `src/client/api.ts`, `src/client/autosave.ts`
- Modify: `src/core/types.ts` (add `ArcSummary`), `src/server/arcStore.ts` (import `ArcSummary` from core instead of declaring it)
- Test: `src/client/autosave.test.ts`

**Interfaces:**
- Consumes: `SaveState` from `src/client/store.ts`; `ArcDoc`, `ArcSummary` from `src/core/types.ts`; `Violation` from `src/core/validate.ts`.
- Produces:
  - `src/client/api.ts`: `type SaveResult = { kind: "saved"; doc: ArcDoc } | { kind: "conflict"; serverDoc: ArcDoc } | { kind: "unauthorized" } | { kind: "offline" } | { kind: "invalid"; violations: Violation[] }`; `login(password)`, `logout()`, `listArcs()`, `createArc({reference, text?})`, `getArc(id)`, `putArc(doc, force?)`
  - `src/client/autosave.ts`: `DEBOUNCE_MS = 1000`, `THROTTLE_MS = 5000`, `OFFLINE_BACKOFF_MS = [2000, 4000, 8000, 16000]`, `mirrorKey(id, rev)`, `localStorageMirror(storage)`, `createAutosave(deps): Autosave` with `changed(doc)`, `flush()`, `retry(doc, opts?)`, `reset()`, `stop()`

- [ ] **Step 1: Move `ArcSummary` into core**

Add to `src/core/types.ts`:

```ts
/** One row of the series list. */
export interface ArcSummary {
  id: string;
  reference: string;
  status: ArcStatus;
  createdAt: string;
  updatedAt: string;
  mainPoint: string;
}
```

In `src/server/arcStore.ts`, delete the local `ArcSummary` interface and import it instead:

```ts
import type { ArcDoc, ArcSummary } from "@/core/types";
```

Add a re-export so nothing that already imports it from the store breaks:

```ts
export type { ArcSummary };
```

Run: `npx vitest run src/server/arcStore.test.ts`
Expected: PASS, unchanged, 8 tests.

- [ ] **Step 2: Write `src/client/api.ts`**

```ts
import type { ArcDoc, ArcSummary } from "@/core/types";
import type { Violation } from "@/core/validate";

export type SaveResult =
  | { kind: "saved"; doc: ArcDoc }
  | { kind: "conflict"; serverDoc: ArcDoc }
  | { kind: "unauthorized" }
  | { kind: "offline" }
  | { kind: "invalid"; violations: Violation[] };

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

export async function listArcs(): Promise<ArcSummary[] | "unauthorized"> {
  const res = await fetch("/api/arcs");
  if (res.status === 401) return "unauthorized";
  return (await res.json()) as ArcSummary[];
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
  if (res.ok) return { kind: "saved", doc: (await res.json()) as ArcDoc };
  if (res.status === 401) return { kind: "unauthorized" };
  if (res.status === 409) {
    const body = (await res.json()) as { doc: ArcDoc };
    return { kind: "conflict", serverDoc: body.doc };
  }
  if (res.status === 400) {
    const body = (await res.json()) as { violations?: Violation[] };
    return { kind: "invalid", violations: body.violations ?? [] };
  }
  return { kind: "offline" };
}
```

- [ ] **Step 3: Write the failing test for the autosave engine**

`src/client/autosave.test.ts`:

```ts
// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { newArcDoc } from "@/core/doc";
import type { ArcDoc } from "@/core/types";
import type { SaveResult } from "./api";
import { createAutosave, localStorageMirror, mirrorKey, OFFLINE_BACKOFF_MS } from "./autosave";

function doc(mainPoint = ""): ArcDoc {
  const base = newArcDoc({
    id: "a-1", reference: "Romans 12:1-2", canonical: "Romans 12:1-2", source: "paste",
    text: "one two", verses: [], now: new Date("2026-09-05T15:00:00Z"),
  });
  return { ...base, summary: { ...base.summary, mainPoint } };
}

function harness(results: SaveResult[]) {
  const save = vi.fn(async (d: ArcDoc): Promise<SaveResult> => results.shift() ?? { kind: "saved", doc: d });
  const onState = vi.fn();
  const onSaved = vi.fn();
  const onConflict = vi.fn();
  const onUnauthorized = vi.fn();
  const auto = createAutosave({
    save,
    onState,
    onSaved,
    onConflict,
    onUnauthorized,
    mirror: localStorageMirror(window.localStorage),
    target: document,
    isHidden: () => document.visibilityState === "hidden",
  });
  return { auto, save, onState, onSaved, onConflict, onUnauthorized };
}

beforeEach(() => {
  vi.useFakeTimers();
  window.localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

test("three changes inside a second produce one save, one second after the last", async () => {
  const h = harness([]);
  h.auto.changed(doc("a"));
  await vi.advanceTimersByTimeAsync(400);
  h.auto.changed(doc("b"));
  await vi.advanceTimersByTimeAsync(400);
  h.auto.changed(doc("c"));
  expect(h.save).not.toHaveBeenCalled();

  await vi.advanceTimersByTimeAsync(1000);
  expect(h.save).toHaveBeenCalledTimes(1);
  expect(h.save.mock.calls[0][0].summary.mainPoint).toBe("c");
  expect(h.onState).toHaveBeenLastCalledWith("saved");
});

test("saves are throttled to one every five seconds while editing", async () => {
  const h = harness([]);
  h.auto.changed(doc("a"));
  await vi.advanceTimersByTimeAsync(1000);
  expect(h.save).toHaveBeenCalledTimes(1);

  h.auto.changed(doc("b"));
  await vi.advanceTimersByTimeAsync(1000);
  expect(h.save).toHaveBeenCalledTimes(1);

  await vi.advanceTimersByTimeAsync(4000);
  expect(h.save).toHaveBeenCalledTimes(2);
});

test("a tab going hidden flushes the pending save immediately", async () => {
  const h = harness([]);
  h.auto.changed(doc("a"));
  Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
  document.dispatchEvent(new Event("visibilitychange"));
  await vi.advanceTimersByTimeAsync(0);
  expect(h.save).toHaveBeenCalledTimes(1);
});

test("the unsaved document is mirrored under its id and base rev, then cleared", async () => {
  const h = harness([]);
  const pending = doc("a");
  h.auto.changed(pending);
  const key = mirrorKey(pending.id, pending.rev);
  expect(JSON.parse(window.localStorage.getItem(key) as string).summary.mainPoint).toBe("a");

  await vi.advanceTimersByTimeAsync(1000);
  expect(window.localStorage.getItem(key)).toBeNull();
});

test("the mirror reads back only for the id and rev it was written at", () => {
  const mirror = localStorageMirror(window.localStorage);
  const pending = doc("a");
  mirror.write(pending);
  expect(mirror.read(pending.id, pending.rev)?.summary.mainPoint).toBe("a");
  expect(mirror.read(pending.id, pending.rev + 1)).toBeNull();
  mirror.clear(pending.id);
  expect(mirror.read(pending.id, pending.rev)).toBeNull();
});

test("a conflict pauses autosave until it is retried", async () => {
  const server = { ...doc("server"), rev: 9 };
  const h = harness([{ kind: "conflict", serverDoc: server }]);
  h.auto.changed(doc("a"));
  await vi.advanceTimersByTimeAsync(1000);
  expect(h.onConflict).toHaveBeenCalledWith(server);
  expect(h.onState).toHaveBeenLastCalledWith("conflict");

  h.auto.changed(doc("b"));
  await vi.advanceTimersByTimeAsync(10_000);
  expect(h.save).toHaveBeenCalledTimes(1);

  h.auto.retry(doc("b"), { force: true });
  await vi.advanceTimersByTimeAsync(6000);
  expect(h.save).toHaveBeenCalledTimes(2);
  expect(h.save.mock.calls[1][1]).toBe(true);
});

test("a 401 pauses and the pending save goes out again after the retry", async () => {
  const h = harness([{ kind: "unauthorized" }]);
  h.auto.changed(doc("a"));
  await vi.advanceTimersByTimeAsync(1000);
  expect(h.onUnauthorized).toHaveBeenCalledTimes(1);

  h.auto.retry(doc("a"));
  await vi.advanceTimersByTimeAsync(6000);
  expect(h.save).toHaveBeenCalledTimes(2);
  expect(h.onState).toHaveBeenLastCalledWith("saved");
});

test("offline retries at two, four, eight and sixteen seconds", async () => {
  const h = harness([
    { kind: "offline" }, { kind: "offline" }, { kind: "offline" }, { kind: "offline" },
  ]);
  h.auto.changed(doc("a"));
  await vi.advanceTimersByTimeAsync(1000);
  expect(h.save).toHaveBeenCalledTimes(1);
  expect(h.onState).toHaveBeenLastCalledWith("offline");

  let expected = 1;
  for (const wait of OFFLINE_BACKOFF_MS) {
    await vi.advanceTimersByTimeAsync(wait - 1);
    expect(h.save).toHaveBeenCalledTimes(expected);
    await vi.advanceTimersByTimeAsync(1);
    expected += 1;
    expect(h.save).toHaveBeenCalledTimes(expected);
  }
  expect(h.onState).toHaveBeenLastCalledWith("saved");
});

test("stop removes the visibility listener", async () => {
  const h = harness([]);
  h.auto.changed(doc("a"));
  h.auto.stop();
  document.dispatchEvent(new Event("visibilitychange"));
  await vi.advanceTimersByTimeAsync(5000);
  expect(h.save).not.toHaveBeenCalled();
});
```

- [ ] **Step 4: Run it and watch it fail**

Run: `npx vitest run src/client/autosave.test.ts`
Expected: FAIL, "Failed to resolve import ./autosave".

- [ ] **Step 5: Write `src/client/autosave.ts`**

```ts
import type { ArcDoc } from "@/core/types";
import type { SaveResult } from "./api";
import type { SaveState } from "./store";

/** PUT one second after the last change. */
export const DEBOUNCE_MS = 1000;
/** At most one PUT every five seconds while editing. */
export const THROTTLE_MS = 5000;
/** iPad Safari suspends tabs, so a hidden tab flushes rather than waits. */
export const OFFLINE_BACKOFF_MS = [2000, 4000, 8000, 16000] as const;

export function mirrorKey(id: string, rev: number): string {
  return `arc:${id}:${rev}`;
}

export interface MirrorPort {
  write(doc: ArcDoc): void;
  read(id: string, rev: number): ArcDoc | null;
  clear(id: string): void;
}

export function localStorageMirror(storage: Storage): MirrorPort {
  return {
    write(doc) {
      try {
        storage.setItem(mirrorKey(doc.id, doc.rev), JSON.stringify(doc));
      } catch {
        // A full or disabled store is not a reason to lose the edit in memory.
      }
    },
    read(id, rev) {
      const raw = storage.getItem(mirrorKey(id, rev));
      if (!raw) return null;
      try {
        return JSON.parse(raw) as ArcDoc;
      } catch {
        return null;
      }
    },
    clear(id) {
      for (let i = storage.length - 1; i >= 0; i -= 1) {
        const key = storage.key(i);
        if (key && key.startsWith(`arc:${id}:`)) storage.removeItem(key);
      }
    },
  };
}

export interface AutosaveDeps {
  save(doc: ArcDoc, force: boolean): Promise<SaveResult>;
  onState(state: SaveState): void;
  onSaved(doc: ArcDoc): void;
  onConflict(serverDoc: ArcDoc): void;
  onUnauthorized(): void;
  mirror: MirrorPort;
  /** Usually document. Omit in a non-DOM context. */
  target?: EventTarget | null;
  isHidden?: () => boolean;
}

export interface Autosave {
  changed(doc: ArcDoc): void;
  flush(): Promise<void>;
  /** Resume after a conflict or a re-login. force sends ?force=1 once. */
  retry(doc: ArcDoc, opts?: { force?: boolean }): void;
  /** Drop the pending edit, for example after choosing Reload on a conflict. */
  reset(): void;
  stop(): void;
}

export function createAutosave(deps: AutosaveDeps): Autosave {
  let pending: ArcDoc | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastSaveAt = Number.NEGATIVE_INFINITY;
  let paused = false;
  let forceNext = false;
  let offlineStep = 0;

  const clearTimer = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };

  const schedule = (delay: number) => {
    clearTimer();
    if (paused || pending === null) return;
    timer = setTimeout(() => {
      timer = null;
      void run();
    }, delay);
  };

  const scheduleNormal = () => {
    const sinceLast = Date.now() - lastSaveAt;
    schedule(Math.max(DEBOUNCE_MS, THROTTLE_MS - sinceLast));
  };

  async function run(): Promise<void> {
    if (paused || pending === null) return;
    const sending = pending;
    const force = forceNext;
    forceNext = false;
    lastSaveAt = Date.now();
    deps.onState("saving");

    const result = await deps.save(sending, force);

    switch (result.kind) {
      case "saved": {
        offlineStep = 0;
        deps.mirror.clear(sending.id);
        deps.onSaved(result.doc);
        if (pending === sending) {
          pending = null;
          deps.onState("saved");
        } else {
          deps.onState("unsaved");
          scheduleNormal();
        }
        return;
      }
      case "conflict": {
        paused = true;
        clearTimer();
        deps.onState("conflict");
        deps.onConflict(result.serverDoc);
        return;
      }
      case "unauthorized": {
        paused = true;
        clearTimer();
        deps.onState("unsaved");
        deps.onUnauthorized();
        return;
      }
      case "offline": {
        const wait = OFFLINE_BACKOFF_MS[Math.min(offlineStep, OFFLINE_BACKOFF_MS.length - 1)];
        offlineStep += 1;
        deps.onState("offline");
        schedule(wait);
        return;
      }
      case "invalid": {
        // A validation failure is a bug in the core, not a user path. Keep the
        // edit pending so the next change retries it, and surface it.
        console.error("save refused as invalid", result.violations);
        deps.onState("unsaved");
        return;
      }
    }
  }

  const onVisibility = () => {
    if (deps.isHidden?.() ?? false) void flush();
  };

  async function flush(): Promise<void> {
    clearTimer();
    await run();
  }

  deps.target?.addEventListener("visibilitychange", onVisibility);

  return {
    changed(doc) {
      pending = doc;
      deps.mirror.write(doc);
      deps.onState("unsaved");
      scheduleNormal();
    },
    flush,
    retry(doc, opts) {
      paused = false;
      forceNext = opts?.force ?? false;
      pending = doc;
      offlineStep = 0;
      scheduleNormal();
    },
    reset() {
      pending = null;
      paused = false;
      forceNext = false;
      offlineStep = 0;
      clearTimer();
    },
    stop() {
      clearTimer();
      pending = null;
      deps.target?.removeEventListener("visibilitychange", onVisibility);
    },
  };
}
```

- [ ] **Step 6: Run the test and watch it pass**

Run: `npx vitest run src/client/autosave.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 7: Run the gate and commit**

```bash
npm run gate
git add src/client/api.ts src/client/autosave.ts src/client/autosave.test.ts src/core/types.ts src/server/arcStore.ts
git commit -m "feat: api client and the debounced autosave engine"
```

---

### Task 14: The login screen

**Files:**
- Create: `src/components/LoginForm.tsx`, `src/app/login/page.tsx`
- Test: `src/components/LoginForm.test.tsx`

**Interfaces:**
- Consumes: `login` from `src/client/api.ts`.
- Produces: `<LoginForm onSignedIn={() => void} />`, rendering a password field, a Sign in button, and one line of error text under the field.

- [ ] **Step 1: Write the failing test**

`src/components/LoginForm.test.tsx`:

```tsx
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
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/components/LoginForm.test.tsx`
Expected: FAIL, "Failed to resolve import ./LoginForm".

- [ ] **Step 3: Write `src/components/LoginForm.tsx`**

```tsx
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
```

`src/app/login/page.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { LoginForm } from "@/components/LoginForm";

export default function LoginPage() {
  const router = useRouter();
  return (
    <main className="page">
      <h1>arcing</h1>
      <LoginForm onSignedIn={() => router.push("/")} />
    </main>
  );
}
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `npx vitest run src/components/LoginForm.test.tsx`
Expected: PASS, 3 tests.

- [ ] **Step 5: Run the gate and commit**

```bash
npm run gate
git add src/components/LoginForm.tsx src/components/LoginForm.test.tsx src/app/login/page.tsx
git commit -m "feat: login screen"
```

---

### Task 15: The series list and the New arc sheet

**Files:**
- Create: `src/components/SeriesList.tsx`, `src/components/NewArcSheet.tsx`, `src/app/page.tsx`
- Test: `src/components/SeriesList.test.tsx`, `src/components/NewArcSheet.test.tsx`

**Interfaces:**
- Consumes: `ArcSummary`, `ArcDoc` from `src/core/types.ts`; `createArc`, `listArcs` from `src/client/api.ts`.
- Produces:
  - `<SeriesList items={ArcSummary[]} onOpen={(id: string) => void} onNew={() => void} />`
  - `<NewArcSheet onCreated={(doc: ArcDoc) => void} onClose={() => void} />`

- [ ] **Step 1: Write the failing test for the list**

`src/components/SeriesList.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import type { ArcSummary } from "@/core/types";
import { SeriesList } from "./SeriesList";

const older: ArcSummary = {
  id: "2026-08-29-romans-6-1-2", reference: "Romans 6:1-2", status: "complete",
  createdAt: "2026-08-29T14:00:00.000Z", updatedAt: "2026-08-29T15:00:00.000Z",
  mainPoint: "Grace is no licence to sin.",
};

const newer: ArcSummary = {
  id: "2026-09-05-romans-12-1-2", reference: "Romans 12:1-2", status: "relating",
  createdAt: "2026-09-05T14:00:00.000Z", updatedAt: "2026-09-05T15:00:00.000Z",
  mainPoint: "",
};

test("an empty series shows one line", () => {
  render(<SeriesList items={[]} onOpen={vi.fn()} onNew={vi.fn()} />);
  expect(screen.getByText("No arcs yet. Start one.")).toBeInTheDocument();
});

test("arcs are listed newest first however they arrive", () => {
  render(<SeriesList items={[older, newer]} onOpen={vi.fn()} onNew={vi.fn()} />);
  const rows = screen.getAllByRole("listitem");
  expect(within(rows[0]).getByText("Romans 12:1-2")).toBeInTheDocument();
  expect(within(rows[1]).getByText("Romans 6:1-2")).toBeInTheDocument();
});

test("a row carries the date, the reference, the status and the main point", () => {
  render(<SeriesList items={[older]} onOpen={vi.fn()} onNew={vi.fn()} />);
  const row = screen.getAllByRole("listitem")[0];
  expect(within(row).getByText("2026-08-29")).toBeInTheDocument();
  expect(within(row).getByText("Romans 6:1-2")).toBeInTheDocument();
  expect(within(row).getByText("complete")).toBeInTheDocument();
  expect(within(row).getByText("Grace is no licence to sin.")).toBeInTheDocument();
});

test("tapping a row opens that arc", async () => {
  const onOpen = vi.fn();
  render(<SeriesList items={[newer]} onOpen={onOpen} onNew={vi.fn()} />);
  await userEvent.click(screen.getByRole("button", { name: /Romans 12:1-2/ }));
  expect(onOpen).toHaveBeenCalledWith("2026-09-05-romans-12-1-2");
});

test("New arc is always offered", async () => {
  const onNew = vi.fn();
  render(<SeriesList items={[]} onOpen={vi.fn()} onNew={onNew} />);
  await userEvent.click(screen.getByRole("button", { name: "New arc" }));
  expect(onNew).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Run it, watch it fail, then write `src/components/SeriesList.tsx`**

Run: `npx vitest run src/components/SeriesList.test.tsx`
Expected: FAIL, "Failed to resolve import ./SeriesList".

```tsx
"use client";

import type { ArcSummary } from "@/core/types";

export function SeriesList({
  items,
  onOpen,
  onNew,
}: {
  items: ArcSummary[];
  onOpen: (id: string) => void;
  onNew: () => void;
}) {
  const sorted = [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <section className="series">
      <header className="series-head">
        <h1>Arcs</h1>
        <button type="button" onClick={onNew}>
          New arc
        </button>
      </header>

      {sorted.length === 0 ? (
        <p className="empty">No arcs yet. Start one.</p>
      ) : (
        <ul className="series-rows">
          {sorted.map((item) => (
            <li key={item.id}>
              <button type="button" onClick={() => onOpen(item.id)}>
                <span className="date">{item.createdAt.slice(0, 10)}</span>
                <span className="reference">{item.reference}</span>
                <span className="status">{item.status}</span>
                <span className="main-point">{item.mainPoint}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
```

Run: `npx vitest run src/components/SeriesList.test.tsx`
Expected: PASS, 5 tests.

- [ ] **Step 3: Write the failing test for the sheet**

`src/components/NewArcSheet.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { NewArcSheet } from "./NewArcSheet";

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubCreate(status: number, body: unknown = {}): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

test("Fetch posts the reference alone so the server resolves the passage", async () => {
  const fetchMock = stubCreate(201, { id: "x" });
  const onCreated = vi.fn();
  render(<NewArcSheet onCreated={onCreated} onClose={vi.fn()} />);

  await userEvent.type(screen.getByLabelText("Reference"), "Romans 12:1-2");
  await userEvent.click(screen.getByRole("button", { name: "Create" }));

  expect(JSON.parse(String(fetchMock.mock.calls[0][1].body))).toEqual({ reference: "Romans 12:1-2" });
  expect(onCreated).toHaveBeenCalledTimes(1);
});

test("Paste posts the reference and the text", async () => {
  const fetchMock = stubCreate(201, { id: "x" });
  render(<NewArcSheet onCreated={vi.fn()} onClose={vi.fn()} />);

  await userEvent.click(screen.getByRole("tab", { name: "Paste" }));
  await userEvent.type(screen.getByLabelText("Reference"), "Romans 12:1-2");
  await userEvent.type(screen.getByLabelText("Passage text"), "I beseech you.");
  await userEvent.click(screen.getByRole("button", { name: "Create" }));

  expect(JSON.parse(String(fetchMock.mock.calls[0][1].body))).toEqual({
    reference: "Romans 12:1-2",
    text: "I beseech you.",
  });
});

test("a 503 switches to Paste and says why", async () => {
  stubCreate(503, { error: "esv_unavailable" });
  render(<NewArcSheet onCreated={vi.fn()} onClose={vi.fn()} />);

  await userEvent.type(screen.getByLabelText("Reference"), "Romans 12:1-2");
  await userEvent.click(screen.getByRole("button", { name: "Create" }));

  expect(await screen.findByRole("alert")).toHaveTextContent("ESV unavailable, paste the text");
  expect(screen.getByRole("tab", { name: "Paste" })).toHaveAttribute("aria-selected", "true");
  expect(screen.getByLabelText("Passage text")).toBeInTheDocument();
});

test("the reference survives the switch to Paste", async () => {
  stubCreate(503, { error: "esv_unavailable" });
  render(<NewArcSheet onCreated={vi.fn()} onClose={vi.fn()} />);

  await userEvent.type(screen.getByLabelText("Reference"), "Romans 12:1-2");
  await userEvent.click(screen.getByRole("button", { name: "Create" }));

  expect(await screen.findByLabelText("Reference")).toHaveValue("Romans 12:1-2");
});
```

- [ ] **Step 4: Run it, watch it fail, then write `src/components/NewArcSheet.tsx`**

Run: `npx vitest run src/components/NewArcSheet.test.tsx`
Expected: FAIL, "Failed to resolve import ./NewArcSheet".

```tsx
"use client";

import { useState, type FormEvent } from "react";
import { createArc } from "@/client/api";
import type { ArcDoc } from "@/core/types";

type Tab = "fetch" | "paste";

export function NewArcSheet({
  onCreated,
  onClose,
}: {
  onCreated: (doc: ArcDoc) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>("fetch");
  const [reference, setReference] = useState("");
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await createArc(tab === "paste" ? { reference, text } : { reference });
    setBusy(false);

    if (result.kind === "created") {
      onCreated(result.doc);
      return;
    }
    if (result.kind === "esv_unavailable") {
      setTab("paste");
      setError("ESV unavailable, paste the text");
      return;
    }
    setError(result.kind === "unauthorized" ? "Sign in again." : result.message);
  }

  return (
    <div className="sheet" role="dialog" aria-label="New arc">
      <div role="tablist" aria-label="Passage source">
        {(["fetch", "paste"] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
          >
            {value === "fetch" ? "Fetch" : "Paste"}
          </button>
        ))}
      </div>

      <form onSubmit={submit}>
        <label htmlFor="reference">Reference</label>
        <input id="reference" value={reference} onChange={(e) => setReference(e.target.value)} />

        {tab === "paste" ? (
          <>
            <label htmlFor="passage-text">Passage text</label>
            <textarea id="passage-text" value={text} onChange={(e) => setText(e.target.value)} rows={8} />
          </>
        ) : null}

        {error === null ? null : <p role="alert">{error}</p>}

        <div className="sheet-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" disabled={busy}>
            Create
          </button>
        </div>
      </form>
    </div>
  );
}
```

Run: `npx vitest run src/components/NewArcSheet.test.tsx`
Expected: PASS, 4 tests.

- [ ] **Step 5: Write the series page**

`src/app/page.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { listArcs } from "@/client/api";
import { NewArcSheet } from "@/components/NewArcSheet";
import { SeriesList } from "@/components/SeriesList";
import type { ArcSummary } from "@/core/types";

export default function SeriesPage() {
  const router = useRouter();
  const [items, setItems] = useState<ArcSummary[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    void (async () => {
      const result = await listArcs();
      if (result === "unauthorized") {
        router.push("/login");
        return;
      }
      setItems(result);
    })();
  }, [router]);

  return (
    <main className="page">
      <SeriesList items={items} onOpen={(id) => router.push(`/a/${id}/split`)} onNew={() => setSheetOpen(true)} />
      {sheetOpen ? (
        <NewArcSheet onCreated={(doc) => router.push(`/a/${doc.id}/split`)} onClose={() => setSheetOpen(false)} />
      ) : null}
    </main>
  );
}
```

- [ ] **Step 6: Run the gate and commit**

```bash
npm run gate
git add src/components/SeriesList.tsx src/components/NewArcSheet.tsx src/components/SeriesList.test.tsx src/components/NewArcSheet.test.tsx src/app/page.tsx
git commit -m "feat: series list and the new arc sheet"
```

---

### Task 16: The arc frame, save chip, ESV notice and the three error states

**Files:**
- Create: `src/components/EsvNotice.tsx`, `src/components/SaveChip.tsx`, `src/components/ArcFrame.tsx`
- Test: `src/components/ArcFrame.test.tsx`

**Interfaces:**
- Consumes: `ESV_NOTICE`, `ESV_URL` from `src/core/tokens.ts`; `SaveState` from `src/client/store.ts`; `ArcDoc` from `src/core/types.ts`; `LoginForm` from `src/components/LoginForm.tsx`.
- Produces:
  - `<EsvNotice />`
  - `<SaveChip state={SaveState} />`
  - `<ArcFrame />` with props `{ reference: string; tab: "split" | "relate" | "summarize"; onTab(tab): void; onSeries(): void; saveState: SaveState; canSummarize: boolean; canUndo: boolean; canRedo: boolean; onUndo(): void; onRedo(): void; showNotice: boolean; conflictDoc: ArcDoc | null; onReload(): void; onOverwrite(): void; needsLogin: boolean; onSignedIn(): void; mirrored: ArcDoc | null; onRestore(): void; onDiscard(): void; children: React.ReactNode }`

- [ ] **Step 1: Write the failing test**

`src/components/ArcFrame.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { newArcDoc } from "@/core/doc";
import { ESV_NOTICE } from "@/core/tokens";
import type { ArcDoc } from "@/core/types";
import { ArcFrame } from "./ArcFrame";

afterEach(() => {
  vi.unstubAllGlobals();
});

function doc(): ArcDoc {
  return newArcDoc({
    id: "a-1", reference: "Romans 12:1-2", canonical: "Romans 12:1-2", source: "paste",
    text: "one two", verses: [], now: new Date("2026-09-05T15:00:00Z"),
  });
}

function frame(overrides: Partial<React.ComponentProps<typeof ArcFrame>> = {}) {
  const props: React.ComponentProps<typeof ArcFrame> = {
    reference: "Romans 12:1-2",
    tab: "split",
    onTab: vi.fn(),
    onSeries: vi.fn(),
    saveState: "saved",
    canSummarize: true,
    canUndo: true,
    canRedo: true,
    onUndo: vi.fn(),
    onRedo: vi.fn(),
    showNotice: true,
    conflictDoc: null,
    onReload: vi.fn(),
    onOverwrite: vi.fn(),
    needsLogin: false,
    onSignedIn: vi.fn(),
    mirrored: null,
    onRestore: vi.fn(),
    onDiscard: vi.fn(),
    children: <p>screen body</p>,
    ...overrides,
  };
  render(<ArcFrame {...props} />);
  return props;
}

test("the frame carries the series link, the reference and the three tabs", async () => {
  const props = frame();
  expect(screen.getByText("Romans 12:1-2")).toBeInTheDocument();
  for (const name of ["Split", "Relate", "Summarize"]) {
    expect(screen.getByRole("tab", { name })).toBeInTheDocument();
  }
  await userEvent.click(screen.getByRole("tab", { name: "Relate" }));
  expect(props.onTab).toHaveBeenCalledWith("relate");

  await userEvent.click(screen.getByRole("button", { name: "Series" }));
  expect(props.onSeries).toHaveBeenCalledTimes(1);
});

test("the save chip shows each of the five states", () => {
  for (const [state, label] of [
    ["saved", "Saved"], ["saving", "Saving"], ["unsaved", "Unsaved"],
    ["offline", "Offline"], ["conflict", "Conflict"],
  ] as const) {
    const { unmount } = render(
      <ArcFrame
        reference="Romans 12:1-2" tab="split" onTab={vi.fn()} onSeries={vi.fn()}
        saveState={state} canSummarize canUndo={false} canRedo={false} onUndo={vi.fn()} onRedo={vi.fn()}
        showNotice={false} conflictDoc={null} onReload={vi.fn()} onOverwrite={vi.fn()}
        needsLogin={false} onSignedIn={vi.fn()} mirrored={null} onRestore={vi.fn()} onDiscard={vi.fn()}
      >
        <p>body</p>
      </ArcFrame>
    );
    expect(screen.getByTestId("save-chip")).toHaveTextContent(label);
    unmount();
  }
});

test("the Summarize tab is closed until one arc spans the passage", () => {
  frame({ canSummarize: false });
  expect(screen.getByRole("tab", { name: "Summarize" })).toBeDisabled();
  expect(screen.getByRole("tab", { name: "Relate" })).toBeEnabled();
});

test("the ESV notice appears verbatim under a view showing passage text", () => {
  frame({ showNotice: true });
  expect(screen.getByTestId("esv-notice")).toHaveTextContent(ESV_NOTICE);
  expect(screen.getByRole("link", { name: "ESV" })).toHaveAttribute("href", "https://www.esv.org");
});

test("a view with no passage text carries no notice", () => {
  frame({ showNotice: false });
  expect(screen.queryByTestId("esv-notice")).toBeNull();
});

test("Undo and Redo call their handlers and disable when there is nothing to do", async () => {
  const props = frame();
  await userEvent.click(screen.getByRole("button", { name: "Undo" }));
  await userEvent.click(screen.getByRole("button", { name: "Redo" }));
  expect(props.onUndo).toHaveBeenCalledTimes(1);
  expect(props.onRedo).toHaveBeenCalledTimes(1);
});

test("Undo and Redo are disabled when the history is empty", () => {
  frame({ canUndo: false, canRedo: false });
  expect(screen.getByRole("button", { name: "Undo" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Redo" })).toBeDisabled();
});

test("the keyboard shortcut also undoes and redoes", async () => {
  const props = frame();
  await userEvent.keyboard("{Meta>}z{/Meta}");
  expect(props.onUndo).toHaveBeenCalledTimes(1);
  await userEvent.keyboard("{Shift>}{Meta>}z{/Meta}{/Shift}");
  expect(props.onRedo).toHaveBeenCalledTimes(1);
});

test("a conflict shows a banner offering Reload and Overwrite", async () => {
  const props = frame({ saveState: "conflict", conflictDoc: { ...doc(), rev: 7 } });
  const banner = screen.getByRole("alert");
  expect(banner).toHaveTextContent("This arc changed somewhere else.");
  await userEvent.click(screen.getByRole("button", { name: "Reload" }));
  expect(props.onReload).toHaveBeenCalledTimes(1);
  await userEvent.click(screen.getByRole("button", { name: "Overwrite" }));
  expect(props.onOverwrite).toHaveBeenCalledTimes(1);
});

test("an expired session opens an inline login that retries the save", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));
  const props = frame({ needsLogin: true });
  expect(screen.getByRole("dialog", { name: "Sign in again" })).toBeInTheDocument();

  await userEvent.type(screen.getByLabelText("Password"), "hunter2");
  await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
  expect(props.onSignedIn).toHaveBeenCalledTimes(1);
});

test("an unsaved mirror offers Restore or Discard", async () => {
  const props = frame({ mirrored: doc() });
  expect(screen.getByText("There are unsaved changes on this device.")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Restore" }));
  expect(props.onRestore).toHaveBeenCalledTimes(1);
  await userEvent.click(screen.getByRole("button", { name: "Discard" }));
  expect(props.onDiscard).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/components/ArcFrame.test.tsx`
Expected: FAIL, "Failed to resolve import ./ArcFrame".

- [ ] **Step 3: Write the three components**

`src/components/EsvNotice.tsx`:

```tsx
import { ESV_NOTICE, ESV_URL } from "@/core/tokens";

const SPLIT_AT = ESV_NOTICE.indexOf("ESV");

/**
 * Crossway's licence requires the notice on every page using the text, with
 * "ESV" linked to www.esv.org. The string itself lives in tokens.ts and is
 * pinned by a test; this only decides where the link goes.
 */
export function EsvNotice() {
  return (
    <p className="esv-notice" data-testid="esv-notice">
      {ESV_NOTICE.slice(0, SPLIT_AT)}
      <a href={ESV_URL} target="_blank" rel="noreferrer">
        ESV
      </a>
      {ESV_NOTICE.slice(SPLIT_AT + "ESV".length)}
    </p>
  );
}
```

`src/components/SaveChip.tsx`:

```tsx
import type { SaveState } from "@/client/store";

const LABELS: Record<SaveState, string> = {
  saved: "Saved",
  saving: "Saving",
  unsaved: "Unsaved",
  offline: "Offline",
  conflict: "Conflict",
};

export function SaveChip({ state }: { state: SaveState }) {
  return (
    <span className={`chip chip-${state}`} data-testid="save-chip" data-state={state}>
      {LABELS[state]}
    </span>
  );
}
```

`src/components/ArcFrame.tsx`:

```tsx
"use client";

import { useEffect, type ReactNode } from "react";
import type { SaveState } from "@/client/store";
import type { ArcDoc } from "@/core/types";
import { EsvNotice } from "./EsvNotice";
import { LoginForm } from "./LoginForm";
import { SaveChip } from "./SaveChip";

export type ArcTab = "split" | "relate" | "summarize";

const TABS: { id: ArcTab; label: string }[] = [
  { id: "split", label: "Split" },
  { id: "relate", label: "Relate" },
  { id: "summarize", label: "Summarize" },
];

export function ArcFrame({
  reference,
  tab,
  onTab,
  onSeries,
  saveState,
  canSummarize,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  showNotice,
  conflictDoc,
  onReload,
  onOverwrite,
  needsLogin,
  onSignedIn,
  mirrored,
  onRestore,
  onDiscard,
  children,
}: {
  reference: string;
  tab: ArcTab;
  onTab: (tab: ArcTab) => void;
  onSeries: () => void;
  saveState: SaveState;
  /** Summarize opens only once one top level unit covers every proposition. */
  canSummarize: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  showNotice: boolean;
  conflictDoc: ArcDoc | null;
  onReload: () => void;
  onOverwrite: () => void;
  needsLogin: boolean;
  onSignedIn: () => void;
  mirrored: ArcDoc | null;
  onRestore: () => void;
  onDiscard: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key.toLowerCase() !== "z" || !(event.metaKey || event.ctrlKey)) return;
      event.preventDefault();
      if (event.shiftKey) onRedo();
      else onUndo();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onUndo, onRedo]);

  return (
    <div className="arc-frame">
      <header className="bar">
        <button type="button" onClick={onSeries}>
          Series
        </button>
        <span className="reference">{reference}</span>

        <nav role="tablist" aria-label="Arc steps">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              disabled={t.id === "summarize" && !canSummarize}
              onClick={() => onTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <SaveChip state={saveState} />
        <button type="button" onClick={onUndo} disabled={!canUndo}>
          Undo
        </button>
        <button type="button" onClick={onRedo} disabled={!canRedo}>
          Redo
        </button>
      </header>

      {conflictDoc === null ? null : (
        <div role="alert" className="banner banner-conflict">
          <span>This arc changed somewhere else.</span>
          <button type="button" onClick={onReload}>
            Reload
          </button>
          <button type="button" onClick={onOverwrite}>
            Overwrite
          </button>
        </div>
      )}

      {mirrored === null ? null : (
        <div className="banner banner-mirror">
          <span>There are unsaved changes on this device.</span>
          <button type="button" onClick={onRestore}>
            Restore
          </button>
          <button type="button" onClick={onDiscard}>
            Discard
          </button>
        </div>
      )}

      <div className="screen">{children}</div>

      {showNotice ? <EsvNotice /> : null}

      {needsLogin ? (
        <div className="modal" role="dialog" aria-label="Sign in again">
          <p>Your session expired. Sign in and the save will go out again.</p>
          <LoginForm onSignedIn={onSignedIn} />
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `npx vitest run src/components/ArcFrame.test.tsx`
Expected: PASS, 11 tests.

- [ ] **Step 5: Run the gate and commit**

```bash
npm run gate
git add src/components/EsvNotice.tsx src/components/SaveChip.tsx src/components/ArcFrame.tsx src/components/ArcFrame.test.tsx
git commit -m "feat: arc frame with save chip, ESV notice, conflict, login and mirror banners"
```

---

### Task 17: The Split screen and the arc workspace

**Files:**
- Create: `src/components/SplitView.tsx`, `src/components/ArcWorkspace.tsx`, `src/app/a/[id]/split/page.tsx`, `src/app/a/[id]/relate/page.tsx`, `src/app/a/[id]/summarize/page.tsx`
- Test: `src/components/SplitView.test.tsx`

**Interfaces:**
- Consumes: `wordStarts`, `splitAt`, `rejoinAt`, `arcsDissolvedBySplit`, `arcsDissolvedByRejoin` from `src/core/split.ts`; `relationship` from `src/core/relationships.ts`; `ArcFrame` from `src/components/ArcFrame.tsx`; store and autosave from `src/client/`.
- Produces:
  - `<SplitView doc={ArcDoc} onChange={(doc: ArcDoc) => void} />`
  - `<ArcWorkspace id={string} tab={ArcTab} />`, the shared shell the other two screens plug into in Tasks 19 and 20.

- [ ] **Step 1: Write the failing test**

`src/components/SplitView.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { createArc } from "@/core/arcTree";
import { newArcDoc } from "@/core/doc";
import { splitAt } from "@/core/split";
import type { ArcDoc } from "@/core/types";
import { SplitView } from "./SplitView";

function fresh(): ArcDoc {
  return newArcDoc({
    id: "a-1", reference: "Romans 12:1-2", canonical: "Romans 12:1-2", source: "paste",
    text: "one two three four", verses: [{ n: 1, start: 0 }, { n: 2, start: 8 }],
    now: new Date("2026-09-05T15:00:00Z"),
  });
}

test("Piper's split rules sit beside the text as static reference", () => {
  render(<SplitView doc={fresh()} onChange={vi.fn()} />);
  expect(screen.getByText(/Relative clauses usually stay inside their proposition/)).toBeInTheDocument();
  expect(screen.getByText(/participles and infinitives become their own proposition when they assert/)).toBeInTheDocument();
});

test("verse numbers render as badges on the word they start", () => {
  render(<SplitView doc={fresh()} onChange={vi.fn()} />);
  expect(screen.getByTestId("verse-1")).toHaveTextContent("1");
  expect(screen.getByTestId("verse-2")).toHaveTextContent("2");
});

test("tapping a word starts a new proposition there", async () => {
  const onChange = vi.fn();
  render(<SplitView doc={fresh()} onChange={onChange} />);

  await userEvent.click(screen.getByTestId("word-8"));

  const next = onChange.mock.calls[0][0] as ArcDoc;
  expect(next.propositions.map((p) => p.text)).toEqual(["one two", "three four"]);
});

test("tapping the first word of a proposition changes nothing", async () => {
  const onChange = vi.fn();
  render(<SplitView doc={fresh()} onChange={onChange} />);
  await userEvent.click(screen.getByTestId("word-0"));
  expect(onChange).not.toHaveBeenCalled();
});

test("tapping a divider rejoins the two propositions", async () => {
  const onChange = vi.fn();
  render(<SplitView doc={splitAt(fresh(), 8)} onChange={onChange} />);

  await userEvent.click(screen.getByRole("button", { name: "Rejoin proposition 2 into 1" }));

  const next = onChange.mock.calls[0][0] as ArcDoc;
  expect(next.propositions).toHaveLength(1);
});

test("a split that would dissolve arcs asks first and names them", async () => {
  const onChange = vi.fn();
  let doc = splitAt(fresh(), 8);
  doc = createArc(doc, [{ kind: "prop", ref: "p1" }, { kind: "prop", ref: "p2" }], "G");
  render(<SplitView doc={doc} onChange={onChange} />);

  await userEvent.click(screen.getByTestId("word-4"));
  expect(onChange).not.toHaveBeenCalled();

  const dialog = screen.getByRole("dialog", { name: "This dissolves arcs" });
  expect(dialog).toHaveTextContent("a1 (Ground)");

  await userEvent.click(screen.getByRole("button", { name: "Split anyway" }));
  const next = onChange.mock.calls[0][0] as ArcDoc;
  expect(next.arcs).toEqual([]);
  expect(next.propositions).toHaveLength(3);
});

test("cancelling the confirm leaves the document alone", async () => {
  const onChange = vi.fn();
  let doc = splitAt(fresh(), 8);
  doc = createArc(doc, [{ kind: "prop", ref: "p1" }, { kind: "prop", ref: "p2" }], "G");
  render(<SplitView doc={doc} onChange={onChange} />);

  await userEvent.click(screen.getByTestId("word-4"));
  await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

  expect(onChange).not.toHaveBeenCalled();
  expect(screen.queryByRole("dialog")).toBeNull();
});

test("a rejoin that would dissolve arcs asks the same way", async () => {
  const onChange = vi.fn();
  let doc = splitAt(fresh(), 8);
  doc = createArc(doc, [{ kind: "prop", ref: "p1" }, { kind: "prop", ref: "p2" }], "G");
  render(<SplitView doc={doc} onChange={onChange} />);

  await userEvent.click(screen.getByRole("button", { name: "Rejoin proposition 2 into 1" }));
  expect(screen.getByRole("dialog", { name: "This dissolves arcs" })).toHaveTextContent("a1 (Ground)");
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/components/SplitView.test.tsx`
Expected: FAIL, "Failed to resolve import ./SplitView".

- [ ] **Step 3: Write `src/components/SplitView.tsx`**

```tsx
"use client";

import { useState } from "react";
import { relationship } from "@/core/relationships";
import { arcsDissolvedByRejoin, arcsDissolvedBySplit, rejoinAt, splitAt, wordStarts } from "@/core/split";
import type { ArcDoc } from "@/core/types";

interface Token {
  start: number;
  word: string;
}

function tokensOf(text: string): Token[] {
  const starts = wordStarts(text);
  return starts.map((start, i) => ({
    start,
    word: text.slice(start, i + 1 < starts.length ? starts[i + 1] : text.length).trimEnd(),
  }));
}

type Pending = { kind: "split"; at: number; arcs: string[] } | { kind: "rejoin"; propId: string; arcs: string[] };

export function SplitView({ doc, onChange }: { doc: ArcDoc; onChange: (doc: ArcDoc) => void }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const tokens = tokensOf(doc.passage.text);
  const verseAt = new Map(doc.passage.verses.map((v) => [v.start, v.n]));

  function apply(action: Pending): void {
    onChange(action.kind === "split" ? splitAt(doc, action.at) : rejoinAt(doc, action.propId));
    setPending(null);
  }

  function requestSplit(at: number): void {
    if (doc.propositions.some((p) => p.start === at)) return;
    const arcs = arcsDissolvedBySplit(doc, at);
    const action: Pending = { kind: "split", at, arcs };
    if (arcs.length > 0) setPending(action);
    else apply(action);
  }

  function requestRejoin(propId: string): void {
    const arcs = arcsDissolvedByRejoin(doc, propId);
    const action: Pending = { kind: "rejoin", propId, arcs };
    if (arcs.length > 0) setPending(action);
    else apply(action);
  }

  return (
    <div className="split-screen">
      <aside className="rules">
        <h2>Piper on splitting</h2>
        <p>Relative clauses usually stay inside their proposition (p. 27).</p>
        <p>Participles and infinitives become their own proposition when they assert something (p. 28).</p>
      </aside>

      <ol className="propositions passage">
        {doc.propositions.map((p, index) => (
          <li key={p.id} data-proposition={p.id}>
            {index > 0 ? (
              <button
                type="button"
                className="divider"
                data-divider={p.id}
                aria-label={`Rejoin proposition ${index + 1} into ${index}`}
                onClick={() => requestRejoin(p.id)}
              >
                X
              </button>
            ) : null}

            <span className="number">{index + 1}</span>

            <span className="words">
              {tokens
                .filter((t) => t.start >= p.start && t.start < p.end)
                .map((t) => (
                  <button
                    key={t.start}
                    type="button"
                    className="word"
                    data-testid={`word-${t.start}`}
                    data-word-start={t.start}
                    onClick={() => requestSplit(t.start)}
                  >
                    {verseAt.has(t.start) ? (
                      <sup className="verse" data-testid={`verse-${verseAt.get(t.start)}`}>
                        {verseAt.get(t.start)}
                      </sup>
                    ) : null}
                    {t.word}
                  </button>
                ))}
            </span>
          </li>
        ))}
      </ol>

      {pending === null ? null : (
        <div className="modal" role="dialog" aria-label="This dissolves arcs">
          <p>These arcs come apart:</p>
          <ul>
            {pending.arcs.map((id) => {
              const node = doc.arcs.find((a) => a.id === id);
              return <li key={id}>{node ? `${id} (${relationship(node.rel).name})` : id}</li>;
            })}
          </ul>
          <button type="button" onClick={() => setPending(null)}>
            Cancel
          </button>
          <button type="button" onClick={() => apply(pending)}>
            {pending.kind === "split" ? "Split anyway" : "Rejoin anyway"}
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `npx vitest run src/components/SplitView.test.tsx`
Expected: PASS, 8 tests.

- [ ] **Step 5: Write the workspace shell and the three pages**

`src/components/ArcWorkspace.tsx`. Its wiring (load, mirror prompt, autosave, conflict, re-login) is covered by the Playwright flow in Task 21 and by the engine tests in Task 13; there is no component test for it here on purpose, because every branch it has is one of those two already.

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { getArc, putArc } from "@/client/api";
import { createAutosave, localStorageMirror, type Autosave } from "@/client/autosave";
import { canRedo, canUndo, redo, undo, useArcStore } from "@/client/store";
import { isRooted } from "@/core/tree";
import type { ArcDoc } from "@/core/types";
import { ArcFrame, type ArcTab } from "./ArcFrame";
import { SplitView } from "./SplitView";

export function ArcWorkspace({ id, tab }: { id: string; tab: ArcTab }) {
  const router = useRouter();
  const doc = useArcStore((s) => s.doc);
  const saveState = useArcStore((s) => s.saveState);
  const conflictDoc = useArcStore((s) => s.conflictDoc);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [mirrored, setMirrored] = useState<ArcDoc | null>(null);
  const autosaveRef = useRef<Autosave | null>(null);

  const mirror = useMemo(() => localStorageMirror(window.localStorage), []);

  useEffect(() => {
    const store = useArcStore.getState();
    const autosave = createAutosave({
      save: (d, force) => putArc(d, force),
      onState: (state) => useArcStore.getState().setSaveState(state),
      onSaved: (saved) => useArcStore.setState({ doc: saved }),
      onConflict: (serverDoc) => useArcStore.getState().setConflictDoc(serverDoc),
      onUnauthorized: () => setNeedsLogin(true),
      mirror,
      target: document,
      isHidden: () => document.visibilityState === "hidden",
    });
    autosaveRef.current = autosave;

    void (async () => {
      const loaded = await getArc(id);
      if (!loaded) {
        router.push("/");
        return;
      }
      store.loadArc(loaded);
      setMirrored(mirror.read(loaded.id, loaded.rev));
    })();

    return () => {
      autosave.stop();
      useArcStore.getState().leaveArc();
    };
  }, [id, mirror, router]);

  function edit(next: ArcDoc): void {
    useArcStore.getState().editDoc(next);
    autosaveRef.current?.changed(next);
  }

  if (!doc) return <main className="page">Loading</main>;

  return (
    <main className="page">
      <ArcFrame
        reference={doc.passage.reference}
        tab={tab}
        onTab={(next) => router.push(`/a/${id}/${next}`)}
        onSeries={() => router.push("/")}
        saveState={saveState}
        canSummarize={isRooted(doc)}
        canUndo={canUndo()}
        canRedo={canRedo()}
        onUndo={() => {
          undo();
          const current = useArcStore.getState().doc;
          if (current) autosaveRef.current?.changed(current);
        }}
        onRedo={() => {
          redo();
          const current = useArcStore.getState().doc;
          if (current) autosaveRef.current?.changed(current);
        }}
        showNotice={tab !== "summarize"}
        conflictDoc={conflictDoc}
        onReload={() => {
          const server = conflictDoc;
          if (!server) return;
          autosaveRef.current?.reset();
          useArcStore.getState().loadArc(server);
        }}
        onOverwrite={() => {
          const current = useArcStore.getState().doc;
          useArcStore.getState().setConflictDoc(null);
          if (current) autosaveRef.current?.retry(current, { force: true });
        }}
        needsLogin={needsLogin}
        onSignedIn={() => {
          setNeedsLogin(false);
          const current = useArcStore.getState().doc;
          if (current) autosaveRef.current?.retry(current);
        }}
        mirrored={mirrored}
        onRestore={() => {
          if (mirrored) edit(mirrored);
          setMirrored(null);
        }}
        onDiscard={() => {
          mirror.clear(id);
          setMirrored(null);
        }}
      >
        {tab === "split" ? <SplitView doc={doc} onChange={edit} /> : null}
      </ArcFrame>
    </main>
  );
}
```

`src/app/a/[id]/split/page.tsx` (the relate and summarize pages are the same file with their own tab value):

```tsx
import { ArcWorkspace } from "@/components/ArcWorkspace";

export default async function SplitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ArcWorkspace id={id} tab="split" />;
}
```

`src/app/a/[id]/relate/page.tsx`:

```tsx
import { ArcWorkspace } from "@/components/ArcWorkspace";

export default async function RelatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ArcWorkspace id={id} tab="relate" />;
}
```

`src/app/a/[id]/summarize/page.tsx`:

```tsx
import { ArcWorkspace } from "@/components/ArcWorkspace";

export default async function SummarizePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ArcWorkspace id={id} tab="summarize" />;
}
```

- [ ] **Step 6: Run the gate, build, and commit**

```bash
npm run gate && npm run build
git add src/components/SplitView.tsx src/components/SplitView.test.tsx src/components/ArcWorkspace.tsx src/app/a
git commit -m "feat: split screen and the arc workspace shell"
```

---

### Task 18: The arc SVG renderer

**Files:**
- Create: `src/components/ArcSvg.tsx`
- Test: `src/components/ArcSvg.test.tsx`

**Interfaces:**
- Consumes: `layout`, `LAYOUT`, `Geometry` from `src/core/layout.ts`; `NEG_POS_SYMBOL` from `src/core/relationships.ts`; `AMBER`, `COLORS` from `src/core/tokens.ts`; `memberKey` from `src/core/tree.ts`.
- Produces: `<ArcSvg doc={ArcDoc} selection={Member[]} onSelectUnit={(unit: Member) => void} onCircle={(arcId: string, memberIndex: number) => void} />`, drawing every hit target the Relate screen and the Playwright flow use: `data-prop` (the row rectangle), `data-arc` (a 44 px circle on the arc's label; the group around it carries `data-arc-group`), `data-circle` (`"<arcId>:<memberIndex>"`), and `data-leaf` on the per-proposition arcs.

- [ ] **Step 1: Write the failing test**

`src/components/ArcSvg.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { piperRomansDoc } from "@/fixtures/piperRomans";
import { ArcSvg } from "./ArcSvg";

function draw(overrides: Partial<React.ComponentProps<typeof ArcSvg>> = {}) {
  const props: React.ComponentProps<typeof ArcSvg> = {
    doc: piperRomansDoc(),
    selection: [],
    onSelectUnit: vi.fn(),
    onCircle: vi.fn(),
    ...overrides,
  };
  const { container } = render(<ArcSvg {...props} />);
  return { container, props };
}

test("there is one hit target per proposition and per arc", () => {
  const { container } = draw();
  expect(container.querySelectorAll("[data-prop]")).toHaveLength(4);
  expect(container.querySelectorAll("[data-arc]")).toHaveLength(3);
});

test("the arc hit target is a 44 px circle on the label, not the whole group", () => {
  const { container } = draw();
  const target = container.querySelector('[data-arc="a1"]') as SVGCircleElement;
  expect(target.tagName.toLowerCase()).toBe("circle");
  expect(target.getAttribute("r")).toBe("22");
});

test("one leaf arc is drawn over every proposition", () => {
  const { container } = draw();
  expect(container.querySelectorAll("[data-leaf]")).toHaveLength(4);
});

test("the viewBox is the geometry's own size", () => {
  const { container } = draw();
  expect(container.querySelector("svg")).toHaveAttribute("viewBox", "0 0 1024 300");
});

test("the circled member is ringed and the other member is a plain target", () => {
  const { container } = draw();
  expect(container.querySelector('[data-circle="a3:0"][data-circled="true"]')).not.toBeNull();
  expect(container.querySelector('[data-circle="a3:1"][data-circled="false"]')).not.toBeNull();
});

test("an arc still missing its circle shows amber on both targets", () => {
  const doc = piperRomansDoc();
  const uncircled = { ...doc, arcs: doc.arcs.map((a) => (a.id === "a2" ? { ...a, circled: null } : a)) };
  const { container } = draw({ doc: uncircled });
  expect(container.querySelectorAll('[data-circle^="a2:"][data-missing="true"]')).toHaveLength(2);
});

test("Negative-Positive draws as a stroke, not as lettering", () => {
  const { container } = draw();
  expect(container.querySelector('[data-arc-group="a1"] [data-negpos]')).not.toBeNull();
  expect(container.querySelector('[data-arc-group="a1"] text')).toBeNull();
});

test("an arc that letters its symbol prints the relationship symbol", () => {
  const { container } = draw();
  expect(container.querySelector('[data-arc-group="a2"] text')).toHaveTextContent("Ac/Pur");
});

test("tapping a proposition selects it", async () => {
  const { container, props } = draw();
  await userEvent.click(container.querySelector('[data-prop="p2"]') as Element);
  expect(props.onSelectUnit).toHaveBeenCalledWith({ kind: "prop", ref: "p2" });
});

test("tapping an arc label selects the arc", async () => {
  const { container, props } = draw();
  await userEvent.click(container.querySelector('[data-arc="a1"]') as Element);
  expect(props.onSelectUnit).toHaveBeenCalledWith({ kind: "arc", ref: "a1" });
});

test("tapping a circle target moves the circle to that member", async () => {
  const { container, props } = draw();
  await userEvent.click(container.querySelector('[data-circle="a3:1"]') as Element);
  expect(props.onCircle).toHaveBeenCalledWith("a3", 1);
});

test("selected units are marked so they can be tinted", () => {
  const { container } = draw({ selection: [{ kind: "prop", ref: "p1" }, { kind: "arc", ref: "a1" }] });
  expect(container.querySelector('[data-prop="p1"]')).toHaveAttribute("data-selected", "true");
  expect(container.querySelector('[data-prop="p2"]')).toHaveAttribute("data-selected", "false");
  expect(container.querySelector('[data-arc="a1"]')).toHaveAttribute("data-selected", "true");
});

test("the proposition text is drawn line by line with its number", () => {
  draw();
  expect(screen.getByText("I beseech you by the mercies of God, brothers, to present")).toBeInTheDocument();
  expect(screen.getByText("4")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/components/ArcSvg.test.tsx`
Expected: FAIL, "Failed to resolve import ./ArcSvg".

- [ ] **Step 3: Write `src/components/ArcSvg.tsx`**

```tsx
"use client";

import { LAYOUT, layout } from "@/core/layout";
import { NEG_POS_SYMBOL } from "@/core/relationships";
import { AMBER, COLORS } from "@/core/tokens";
import { memberKey } from "@/core/tree";
import type { ArcDoc, Member } from "@/core/types";

/** Half of the 44 px touch floor. */
const TARGET_R = 22;

export function ArcSvg({
  doc,
  selection,
  onSelectUnit,
  onCircle,
}: {
  doc: ArcDoc;
  selection: Member[];
  onSelectUnit: (unit: Member) => void;
  onCircle: (arcId: string, memberIndex: number) => void;
}) {
  const geometry = layout(doc, "stacked");
  const selected = new Set(selection.map(memberKey));

  return (
    <svg
      className="arc-svg"
      viewBox={`0 0 ${geometry.width} ${geometry.height}`}
      width="100%"
      role="img"
      aria-label={`${doc.passage.reference} arced`}
    >
      {/* proposition rows: text, number, and a full-width hit target */}
      {geometry.props.map((box, index) => {
        const isSelected = selected.has(`prop:${box.id}`);
        return (
          <g key={box.id}>
            <text x={LAYOUT.NUMBER_X} y={box.y + LAYOUT.FIRST_BASELINE} textAnchor="end" className="prop-number">
              {index + 1}
            </text>
            {box.lines.map((line, i) => (
              <text key={i} x={box.x} y={box.y + LAYOUT.FIRST_BASELINE + i * LAYOUT.LINE_HEIGHT} className="prop-text">
                {line}
              </text>
            ))}
            <rect
              data-prop={box.id}
              data-selected={isSelected}
              x={0}
              y={box.y}
              width={LAYOUT.BASELINE_X}
              height={box.h}
              fill={isSelected ? COLORS.accent : "transparent"}
              fillOpacity={isSelected ? 0.12 : 0}
              onClick={() => onSelectUnit({ kind: "prop", ref: box.id })}
            />
          </g>
        );
      })}

      {/* the baseline and its boundary ticks */}
      <path
        className="stroke"
        d={`M${geometry.baseline.x} ${geometry.baseline.y0} V${geometry.baseline.y1}`}
      />
      {geometry.baseline.ticks.map((y) => (
        <path key={y} className="stroke" d={`M${geometry.baseline.x - LAYOUT.TICK} ${y} H${geometry.baseline.x}`} />
      ))}

      {/* one arc over every proposition, Piper's own convention */}
      {geometry.leaves.map((leaf) => (
        <path key={leaf.propId} data-leaf={leaf.propId} className="stroke" d={leaf.d} />
      ))}

      {/* the relationship arcs, their symbols, and their circle targets */}
      {geometry.arcs.map((shape) => {
        const node = doc.arcs.find((a) => a.id === shape.id);
        if (!node) return null;
        const isSelected = selected.has(`arc:${shape.id}`);
        const missingCircle = shape.circles.length > 0 && node.circled === null;

        return (
          <g key={shape.id} data-arc-group={shape.id} data-selected={isSelected}>
            <path className="stroke" d={shape.d} stroke={isSelected ? COLORS.accent : COLORS.ink} />

            {shape.sym === NEG_POS_SYMBOL ? (
              <path
                data-negpos="true"
                className="stroke"
                d={`M${shape.labelX - 12} ${shape.labelY - 6} H${shape.labelX + 12}`}
              />
            ) : (
              <text x={shape.labelX} y={shape.labelY} textAnchor="middle" className="arc-symbol">
                {shape.sym}
              </text>
            )}

            {/*
              The arc's own hit target is this circle on its label, never the
              whole group: a group's bounding box is mostly empty, so a real
              browser click at its centre lands on whatever is painted there.
            */}
            <circle
              data-arc={shape.id}
              data-selected={isSelected}
              cx={shape.labelX}
              cy={shape.labelY - LAYOUT.LABEL_BASELINE}
              r={TARGET_R}
              fill="transparent"
              onClick={() => onSelectUnit({ kind: "arc", ref: shape.id })}
            />

            {shape.circles.map((circle) => {
              const isCircled = node.circled === circle.memberIndex;
              return (
                <g key={circle.memberIndex}>
                  {isCircled ? <ellipse cx={circle.x} cy={circle.y} rx={21} ry={14} className="stroke circle-ring" /> : null}
                  <circle
                    data-circle={`${shape.id}:${circle.memberIndex}`}
                    data-circled={isCircled}
                    data-missing={missingCircle}
                    cx={circle.x}
                    cy={circle.y}
                    r={TARGET_R}
                    fill="transparent"
                    stroke={missingCircle ? AMBER : "transparent"}
                    strokeDasharray={missingCircle ? "3 3" : undefined}
                    onClick={(event) => {
                      event.stopPropagation();
                      onCircle(shape.id, circle.memberIndex);
                    }}
                  />
                </g>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}
```

Add to `src/app/globals.css`:

```css
.arc-svg text { font-family: var(--sans); font-size: 17px; fill: var(--ink); }
.arc-svg .prop-text { font-family: var(--serif); }
.arc-svg .prop-number, .arc-svg .arc-symbol { font-weight: 700; }
.arc-svg .stroke { fill: none; stroke: var(--ink); stroke-width: 3; stroke-linecap: round; }
.arc-svg .circle-ring { stroke-width: 2.5; }
.arc-svg [data-prop], .arc-svg [data-arc], .arc-svg [data-circle] { cursor: pointer; }
.arc-svg [data-arc-group][data-selected="true"] .arc-symbol { fill: var(--accent); }
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `npx vitest run src/components/ArcSvg.test.tsx`
Expected: PASS, 13 tests.

- [ ] **Step 5: Run the gate and commit**

```bash
npm run gate
git add src/components/ArcSvg.tsx src/components/ArcSvg.test.tsx src/app/globals.css
git commit -m "feat: inline SVG arc renderer with proposition, arc and circle targets"
```

---

### Task 19: The Relate screen and the palette of 18

**Files:**
- Create: `src/components/Palette.tsx`, `src/components/RelateView.tsx`
- Modify: `src/components/ArcWorkspace.tsx` (render `RelateView` on the relate tab)
- Test: `src/components/Palette.test.tsx`, `src/components/RelateView.test.tsx`

**Interfaces:**
- Consumes: `RELATIONSHIPS`, `GROUP_ORDER`, `GROUP_HEADINGS`, `relationship` from `src/core/relationships.ts`; `canRelate`, `createArc`, `relabelArc`, `dissolveArc`, `setCircled`, `arcsDissolvedByDissolve` from `src/core/arcTree.ts`; `ArcSvg` from `src/components/ArcSvg.tsx`; `useArcStore` from `src/client/store.ts`.
- Produces:
  - `<Palette doc={ArcDoc} units={Member[]} onPick={(code: RelCode) => void} />`
  - `<RelateView doc={ArcDoc} onChange={(doc: ArcDoc) => void} />`

- [ ] **Step 1: Add `canRelabel` to `src/core/arcTree.ts`**

Relabelling asks a different question from relating: an existing arc's members are adjacent by
construction, and they are not top level whenever the arc has a parent, so `canRelate` would answer
"Select neighbours" for every row. Only the member count matters.

Write the failing test first, appended to `src/core/arcTree.test.ts`:

```ts
test("relabel fit is judged against the arc's own member count", () => {
  let doc = createArc(fiveProps(), [prop("p1"), prop("p2")], "NegPos");
  doc = createArc(doc, [arc("a1"), prop("p3")], "G");
  expect(canRelabel(doc, "a1", "Cf")).toEqual({ ok: true });
  expect(canRelabel(doc, "a1", "BL")).toEqual({ ok: false, reason: "Takes exactly 3" });
});
```

Add `canRelabel` to the file's import list in the test, then run it.

Run: `npx vitest run src/core/arcTree.test.ts`
Expected: FAIL, "canRelabel is not exported by src/core/arcTree.ts".

Add to `src/core/arcTree.ts`:

```ts
/**
 * Fit for RELABELLING an existing arc. Unlike canRelate this asks only about
 * the member count: the members are already adjacent by construction, and
 * they are not top level whenever the arc has a parent.
 */
export function canRelabel(doc: ArcDoc, arcId: string, code: RelCode): Fit {
  const target = doc.arcs.find((a) => a.id === arcId);
  if (!target) return { ok: false, reason: "Unknown arc" };
  const rel = relationship(code);
  const n = target.members.length;
  if (rel.maxMembers === null) {
    return n >= rel.minMembers ? { ok: true } : { ok: false, reason: `Takes ${rel.minMembers} or more` };
  }
  return n === rel.minMembers ? { ok: true } : { ok: false, reason: `Takes exactly ${rel.minMembers}` };
}
```

Run: `npx vitest run src/core/arcTree.test.ts`
Expected: PASS, 16 tests.

- [ ] **Step 2: Write the failing test for the palette**

`src/components/Palette.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { newArcDoc } from "@/core/doc";
import { splitAt } from "@/core/split";
import type { ArcDoc, Member } from "@/core/types";
import { Palette } from "./Palette";

function fourProps(): ArcDoc {
  let doc = newArcDoc({
    id: "a-1", reference: "Romans 12:1-2", canonical: "Romans 12:1-2", source: "paste",
    text: "one two three four", verses: [], now: new Date("2026-09-05T15:00:00Z"),
  });
  for (const at of [4, 8, 14]) doc = splitAt(doc, at);
  return doc;
}

const prop = (ref: string): Member => ({ kind: "prop", ref });

test("all 18 relationships are on screen under four headings", () => {
  render(<Palette doc={fourProps()} units={[prop("p1"), prop("p2")]} onPick={vi.fn()} />);
  expect(screen.getAllByRole("button", { name: /./ })).toHaveLength(18);
  for (const heading of [
    "Coordinate",
    "Support by restatement",
    "Support by distinct statement",
    "Support by contrary statement",
  ]) {
    expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
  }
});

test("each row carries its one line definition", () => {
  render(<Palette doc={fourProps()} units={[prop("p1"), prop("p2")]} onPick={vi.fn()} />);
  expect(screen.getByText("An action and its intended result.")).toBeInTheDocument();
});

test("Ground and Inference carry Piper's warning", () => {
  render(<Palette doc={fourProps()} units={[prop("p1"), prop("p2")]} onPick={vi.fn()} />);
  expect(screen.getAllByTestId("ground-inference-warning")).toHaveLength(1);
  expect(screen.getByTestId("ground-inference-warning")).toHaveTextContent(
    "In Ground the conclusion comes first; in Inference it comes second."
  );
});

test("the three circling relationships say so", () => {
  render(<Palette doc={fourProps()} units={[prop("p1"), prop("p2")]} onPick={vi.fn()} />);
  expect(screen.getByTestId("rel-AcPur")).toHaveTextContent("circle one");
  expect(screen.getByTestId("rel-AcRes")).toHaveTextContent("circle one");
  expect(screen.getByTestId("rel-SitR")).toHaveTextContent("circle one");
  expect(screen.getByTestId("rel-G")).not.toHaveTextContent("circle one");
});

test("three adjacent units enable only Series, Progression, Alternative and Bilateral", () => {
  render(
    <Palette doc={fourProps()} units={[prop("p1"), prop("p2"), prop("p3")]} onPick={vi.fn()} />
  );
  for (const code of ["S", "P", "A", "BL"]) {
    expect(screen.getByTestId(`rel-${code}`)).toBeEnabled();
  }
  for (const code of ["G", "Inf", "AcPur", "NegPos", "Csv", "SitR", "T", "L"]) {
    expect(screen.getByTestId(`rel-${code}`)).toBeDisabled();
  }
});

test("a disabled row says why", () => {
  render(<Palette doc={fourProps()} units={[prop("p1"), prop("p2"), prop("p3")]} onPick={vi.fn()} />);
  expect(screen.getByTestId("rel-G")).toHaveTextContent("Takes exactly 2");
});

test("picking a relationship reports its code", async () => {
  const onPick = vi.fn();
  render(<Palette doc={fourProps()} units={[prop("p1"), prop("p2")]} onPick={onPick} />);
  await userEvent.click(screen.getByTestId("rel-G"));
  expect(onPick).toHaveBeenCalledWith("G");
});
```

Run: `npx vitest run src/components/Palette.test.tsx`
Expected: FAIL, "Failed to resolve import ./Palette".

- [ ] **Step 3: Write `src/components/Palette.tsx`**

```tsx
"use client";

import { canRelabel, canRelate } from "@/core/arcTree";
import { GROUP_HEADINGS, GROUP_ORDER, RELATIONSHIPS, type RelCode } from "@/core/relationships";
import type { ArcDoc, Member } from "@/core/types";

/**
 * All 18 on screen at once, in Piper's four groups, each with its one line
 * definition. This is the whole reason the tool exists rather than Biblearc:
 * choosing a label is comparing candidates, not recalling a name.
 */
export function Palette({
  doc,
  units,
  relabelArcId = null,
  onPick,
}: {
  doc: ArcDoc;
  units: Member[];
  /** Set while relabelling an existing arc; fit is then judged on its members. */
  relabelArcId?: string | null;
  onPick: (code: RelCode) => void;
}) {
  return (
    <div className="palette">
      {GROUP_ORDER.map((group) => (
        <section key={group} className="palette-group">
          <h4>{GROUP_HEADINGS[group]}</h4>
          {RELATIONSHIPS.filter((rel) => rel.group === group).map((rel) => {
            const fit = relabelArcId ? canRelabel(doc, relabelArcId, rel.code) : canRelate(doc, units, rel.code);
            return (
              <div key={rel.code} className="palette-row">
                <button
                  type="button"
                  data-testid={`rel-${rel.code}`}
                  data-rel={rel.code}
                  disabled={!fit.ok}
                  onClick={() => onPick(rel.code)}
                >
                  <span className="sym">{rel.symbol}</span>
                  <span className="name">
                    {rel.name}
                    {rel.requiresCircle ? <span className="ring">circle one</span> : null}
                  </span>
                  <span className="def">{rel.definition}</span>
                  {fit.ok ? null : <span className="why">{fit.reason}</span>}
                </button>
                {rel.code === "Inf" && rel.warning ? (
                  <p className="warn" data-testid="ground-inference-warning">
                    {rel.warning}
                  </p>
                ) : null}
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
}
```

Run: `npx vitest run src/components/Palette.test.tsx`
Expected: PASS, 7 tests.

- [ ] **Step 4: Write the failing test for the Relate screen**

`src/components/RelateView.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { useArcStore } from "@/client/store";
import { newArcDoc } from "@/core/doc";
import { splitAt } from "@/core/split";
import type { ArcDoc } from "@/core/types";
import { piperRomansDoc } from "@/fixtures/piperRomans";
import { RelateView } from "./RelateView";

function fourProps(): ArcDoc {
  let doc = newArcDoc({
    id: "a-1", reference: "Romans 12:1-2", canonical: "Romans 12:1-2", source: "paste",
    text: "one two three four", verses: [], now: new Date("2026-09-05T15:00:00Z"),
  });
  for (const at of [4, 8, 14]) doc = splitAt(doc, at);
  return doc;
}

beforeEach(() => {
  useArcStore.setState({ doc: null, saveState: "saved", selection: [], conflictDoc: null });
});

async function select(testIdSelector: string, container: HTMLElement): Promise<void> {
  await userEvent.click(container.querySelector(testIdSelector) as Element);
}

test("selecting two neighbours and picking Ground draws the arc", async () => {
  const onChange = vi.fn();
  const { container } = render(<RelateView doc={fourProps()} onChange={onChange} />);

  await select('[data-prop="p1"]', container);
  await select('[data-prop="p2"]', container);
  await userEvent.click(screen.getByTestId("rel-G"));

  const next = onChange.mock.calls[0][0] as ArcDoc;
  expect(next.arcs).toHaveLength(1);
  expect(next.arcs[0].rel).toBe("G");
  expect(next.arcs[0].members).toEqual([{ kind: "prop", ref: "p1" }, { kind: "prop", ref: "p2" }]);
});

test("a non-adjacent selection disables every row and says Select neighbours", async () => {
  const { container } = render(<RelateView doc={fourProps()} onChange={vi.fn()} />);

  await select('[data-prop="p1"]', container);
  await select('[data-prop="p3"]', container);

  expect(screen.getByTestId("rel-S")).toBeDisabled();
  expect(screen.getByTestId("rel-S")).toHaveTextContent("Select neighbours");
});

test("tapping a selected unit again deselects it", async () => {
  const { container } = render(<RelateView doc={fourProps()} onChange={vi.fn()} />);
  await select('[data-prop="p1"]', container);
  expect(container.querySelector('[data-prop="p1"]')).toHaveAttribute("data-selected", "true");
  await select('[data-prop="p1"]', container);
  expect(container.querySelector('[data-prop="p1"]')).toHaveAttribute("data-selected", "false");
});

test("an Ac-Pur arc puts a circle target on each of its two members", async () => {
  const onChange = vi.fn();
  const { container } = render(<RelateView doc={fourProps()} onChange={onChange} />);

  await select('[data-prop="p1"]', container);
  await select('[data-prop="p2"]', container);
  await userEvent.click(screen.getByTestId("rel-AcPur"));

  const next = onChange.mock.calls[0][0] as ArcDoc;
  const { container: after } = render(<RelateView doc={next} onChange={vi.fn()} />);
  expect(after.querySelectorAll('[data-circle^="a1:"]')).toHaveLength(2);
});

test("tapping the other circle target moves the circle", async () => {
  const onChange = vi.fn();
  const { container } = render(<RelateView doc={piperRomansDoc()} onChange={onChange} />);

  await select('[data-circle="a3:1"]', container);

  const next = onChange.mock.calls[0][0] as ArcDoc;
  expect(next.arcs.find((a) => a.id === "a3")?.circled).toBe(1);
});

test("tapping an arc offers Relabel and Dissolve", async () => {
  const onChange = vi.fn();
  const { container } = render(<RelateView doc={piperRomansDoc()} onChange={onChange} />);

  await select('[data-arc="a1"]', container);
  await userEvent.click(screen.getByRole("button", { name: "Dissolve" }));

  const next = onChange.mock.calls[0][0] as ArcDoc;
  expect(next.arcs.map((a) => a.id)).toEqual([]);
});

test("relabelling an arc keeps its members", async () => {
  const onChange = vi.fn();
  const { container } = render(<RelateView doc={piperRomansDoc()} onChange={onChange} />);

  await select('[data-arc="a1"]', container);
  await userEvent.click(screen.getByRole("button", { name: "Relabel" }));
  await userEvent.click(screen.getByTestId("rel-Cf"));

  const next = onChange.mock.calls[0][0] as ArcDoc;
  const relabelled = next.arcs.find((a) => a.id === "a1");
  expect(relabelled?.rel).toBe("Cf");
  expect(relabelled?.members).toHaveLength(2);
});

test("dissolving an arc with parents warns which come apart", async () => {
  const { container } = render(<RelateView doc={piperRomansDoc()} onChange={vi.fn()} />);
  await select('[data-arc="a1"]', container);
  expect(screen.getByTestId("dissolve-warning")).toHaveTextContent("a1, a2, a3");
});
```

Run: `npx vitest run src/components/RelateView.test.tsx`
Expected: FAIL, "Failed to resolve import ./RelateView".

- [ ] **Step 5: Write `src/components/RelateView.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useArcStore } from "@/client/store";
import { arcsDissolvedByDissolve, createArc, dissolveArc, relabelArc, setCircled } from "@/core/arcTree";
import type { RelCode } from "@/core/relationships";
import { memberKey } from "@/core/tree";
import type { ArcDoc, Member } from "@/core/types";
import { ArcSvg } from "./ArcSvg";
import { Palette } from "./Palette";

export function RelateView({ doc, onChange }: { doc: ArcDoc; onChange: (doc: ArcDoc) => void }) {
  const selection = useArcStore((s) => s.selection);
  const setSelection = useArcStore((s) => s.setSelection);
  const [relabelling, setRelabelling] = useState<string | null>(null);

  const focusedArc = selection.length === 1 && selection[0].kind === "arc" ? selection[0].ref : null;

  function toggle(unit: Member): void {
    const key = memberKey(unit);
    const already = selection.some((u) => memberKey(u) === key);
    setSelection(already ? selection.filter((u) => memberKey(u) !== key) : [...selection, unit]);
    setRelabelling(null);
  }

  function pick(code: RelCode): void {
    if (relabelling) {
      onChange(relabelArc(doc, relabelling, code));
      setRelabelling(null);
      setSelection([]);
      return;
    }
    onChange(createArc(doc, selection, code));
    setSelection([]);
  }

  return (
    <div className="relate-screen">
      <ArcSvg
        doc={doc}
        selection={selection}
        onSelectUnit={toggle}
        onCircle={(arcId, memberIndex) => onChange(setCircled(doc, arcId, memberIndex))}
      />

      {focusedArc === null ? null : (
        <div className="arc-actions">
          <button type="button" onClick={() => setRelabelling(focusedArc)}>
            Relabel
          </button>
          <button
            type="button"
            className="destructive"
            onClick={() => {
              onChange(dissolveArc(doc, focusedArc));
              setSelection([]);
            }}
          >
            Dissolve
          </button>
          <p className="warn" data-testid="dissolve-warning">
            Dissolving takes these apart: {arcsDissolvedByDissolve(doc, focusedArc).join(", ")}
          </p>
        </div>
      )}

      <Palette doc={doc} units={selection} relabelArcId={relabelling} onPick={pick} />
    </div>
  );
}
```

Add to `src/app/globals.css`:

```css
.arc-actions .destructive { color: var(--destructive); }
.palette-row button[disabled] { opacity: 0.45; }
.palette-row .why { color: var(--destructive); }
```

- [ ] **Step 6: Run the Relate tests and watch them pass**

Run: `npx vitest run src/components/RelateView.test.tsx src/components/Palette.test.tsx`
Expected: PASS, 8 + 7 tests.

- [ ] **Step 7: Render the Relate screen in the workspace**

In `src/components/ArcWorkspace.tsx`, import `RelateView` and extend the body:

```tsx
{tab === "split" ? <SplitView doc={doc} onChange={edit} /> : null}
{tab === "relate" ? <RelateView doc={doc} onChange={edit} /> : null}
```

- [ ] **Step 8: Run the gate and commit**

```bash
npm run gate
git add src/components/Palette.tsx src/components/RelateView.tsx src/components/Palette.test.tsx src/components/RelateView.test.tsx src/core/arcTree.ts src/core/arcTree.test.ts src/components/ArcWorkspace.tsx
git commit -m "feat: relate screen with all 18 relationships visible"
```

---

### Task 20: The Summarize screen

**Files:**
- Create: `src/components/SummarizeView.tsx`
- Modify: `src/components/ArcWorkspace.tsx` (render `SummarizeView` on the summarize tab)
- Test: `src/components/SummarizeView.test.tsx`

**Interfaces:**
- Consumes: `completionMissing` from `src/core/status.ts`; `deriveStatus` from `src/core/status.ts`; `ArcDoc`, `Level` from `src/core/types.ts`.
- Produces: `<SummarizeView doc={ArcDoc} onChange={(doc: ArcDoc) => void} />`

- [ ] **Step 1: Write the failing test**

`src/components/SummarizeView.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import type { ArcDoc } from "@/core/types";
import { piperRomansDoc } from "@/fixtures/piperRomans";
import { SummarizeView } from "./SummarizeView";

function ready(): ArcDoc {
  const doc = piperRomansDoc();
  return {
    ...doc,
    summary: {
      mainPoint: "Be transformed so that you present your bodies to God.",
      levels: [{ text: "God's mercies are the ground.", connector: "" }],
      whyItMatters: "It reframes obedience as worship.",
    },
  };
}

test("nothing is prefilled on a fresh arc", () => {
  render(<SummarizeView doc={piperRomansDoc()} onChange={vi.fn()} />);
  expect(screen.getByLabelText("Main point")).toHaveValue("");
  expect(screen.getByLabelText("Why it matters")).toHaveValue("");
  expect(screen.queryByLabelText("Level 1")).toBeNull();
});

test("typing the main point reports the edit", async () => {
  const onChange = vi.fn();
  render(<SummarizeView doc={piperRomansDoc()} onChange={onChange} />);
  await userEvent.type(screen.getByLabelText("Main point"), "G");
  expect((onChange.mock.calls[0][0] as ArcDoc).summary.mainPoint).toBe("G");
});

test("adding a level appends it above the previous one", async () => {
  const onChange = vi.fn();
  render(<SummarizeView doc={ready()} onChange={onChange} />);
  await userEvent.click(screen.getByRole("button", { name: "Add level" }));
  const next = onChange.mock.calls[0][0] as ArcDoc;
  expect(next.summary.levels).toHaveLength(2);
  expect(next.summary.levels[1].text).toBe("");
});

test("the topmost level has no connector field and stores an empty connector", async () => {
  const doc = ready();
  const two: ArcDoc = {
    ...doc,
    summary: {
      ...doc.summary,
      levels: [{ text: "bottom", connector: "therefore" }, { text: "top", connector: "" }],
    },
  };
  render(<SummarizeView doc={two} onChange={vi.fn()} />);
  expect(screen.getByLabelText("Connector above level 1")).toHaveValue("therefore");
  expect(screen.queryByLabelText("Connector above level 2")).toBeNull();
});

test("removing a level keeps the topmost connector empty", async () => {
  const onChange = vi.fn();
  const doc = ready();
  const two: ArcDoc = {
    ...doc,
    summary: {
      ...doc.summary,
      levels: [{ text: "bottom", connector: "therefore" }, { text: "top", connector: "" }],
    },
  };
  render(<SummarizeView doc={two} onChange={onChange} />);
  await userEvent.click(screen.getByRole("button", { name: "Remove level 2" }));
  const next = onChange.mock.calls[0][0] as ArcDoc;
  expect(next.summary.levels).toEqual([{ text: "bottom", connector: "" }]);
});

test("moving a level up reorders it and clears the new topmost connector", async () => {
  const onChange = vi.fn();
  const doc = ready();
  const two: ArcDoc = {
    ...doc,
    summary: {
      ...doc.summary,
      levels: [{ text: "bottom", connector: "therefore" }, { text: "top", connector: "" }],
    },
  };
  render(<SummarizeView doc={two} onChange={onChange} />);
  await userEvent.click(screen.getByRole("button", { name: "Move level 1 up" }));
  const next = onChange.mock.calls[0][0] as ArcDoc;
  expect(next.summary.levels.map((l) => l.text)).toEqual(["top", "bottom"]);
  expect(next.summary.levels[1].connector).toBe("");
});

test("Mark complete is disabled and lists what is missing", () => {
  render(<SummarizeView doc={piperRomansDoc()} onChange={vi.fn()} />);
  expect(screen.getByRole("button", { name: "Mark complete" })).toBeDisabled();
  const missing = screen.getByTestId("missing-list");
  expect(missing).toHaveTextContent("A main point sentence");
  expect(missing).toHaveTextContent("At least one level with text");
});

test("Mark complete sets the flag and the derived status", async () => {
  const onChange = vi.fn();
  render(<SummarizeView doc={ready()} onChange={onChange} />);
  const button = screen.getByRole("button", { name: "Mark complete" });
  expect(button).toBeEnabled();

  await userEvent.click(button);
  const next = onChange.mock.calls[0][0] as ArcDoc;
  expect(next.markedComplete).toBe(true);
  expect(next.status).toBe("complete");
});

test("a complete arc is still editable", async () => {
  const onChange = vi.fn();
  const complete: ArcDoc = { ...ready(), markedComplete: true, status: "complete" };
  render(<SummarizeView doc={complete} onChange={onChange} />);
  expect(screen.getByLabelText("Main point")).toBeEnabled();
  await userEvent.type(screen.getByLabelText("Why it matters"), "!");
  expect(onChange).toHaveBeenCalled();
});

test("an unfinished circle blocks completion and says which arc", () => {
  const doc = ready();
  const uncircled: ArcDoc = { ...doc, arcs: doc.arcs.map((a) => (a.id === "a2" ? { ...a, circled: null } : a)) };
  render(<SummarizeView doc={uncircled} onChange={vi.fn()} />);
  expect(screen.getByTestId("missing-list")).toHaveTextContent("A circled member on the Action-Purpose arc (a2)");
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/components/SummarizeView.test.tsx`
Expected: FAIL, "Failed to resolve import ./SummarizeView".

- [ ] **Step 3: Write `src/components/SummarizeView.tsx`**

```tsx
"use client";

import { completionMissing, deriveStatus } from "@/core/status";
import type { ArcDoc, Level, Summary } from "@/core/types";

/** The topmost level has nothing above it, so its connector is always "". */
function normalizeLevels(levels: Level[]): Level[] {
  return levels.map((level, i) => (i === levels.length - 1 ? { ...level, connector: "" } : level));
}

export function SummarizeView({ doc, onChange }: { doc: ArcDoc; onChange: (doc: ArcDoc) => void }) {
  const missing = completionMissing(doc);
  const levels = doc.summary.levels;

  function withSummary(summary: Summary): void {
    const next: ArcDoc = { ...doc, summary: { ...summary, levels: normalizeLevels(summary.levels) } };
    onChange({ ...next, status: deriveStatus(next) });
  }

  function setLevels(nextLevels: Level[]): void {
    withSummary({ ...doc.summary, levels: nextLevels });
  }

  return (
    <div className="summarize-screen">
      <label htmlFor="main-point">Main point</label>
      <input
        id="main-point"
        value={doc.summary.mainPoint}
        onChange={(e) => withSummary({ ...doc.summary, mainPoint: e.target.value })}
      />

      <section className="levels">
        <h2>The argument, bottom to top</h2>
        {levels.map((level, index) => (
          <div key={index} className="level">
            <label htmlFor={`level-${index + 1}`}>{`Level ${index + 1}`}</label>
            <input
              id={`level-${index + 1}`}
              value={level.text}
              onChange={(e) =>
                setLevels(levels.map((l, i) => (i === index ? { ...l, text: e.target.value } : l)))
              }
            />

            {index === levels.length - 1 ? null : (
              <>
                <label htmlFor={`connector-${index + 1}`}>{`Connector above level ${index + 1}`}</label>
                <input
                  id={`connector-${index + 1}`}
                  value={level.connector}
                  onChange={(e) =>
                    setLevels(levels.map((l, i) => (i === index ? { ...l, connector: e.target.value } : l)))
                  }
                />
              </>
            )}

            <button
              type="button"
              aria-label={`Move level ${index + 1} up`}
              disabled={index === levels.length - 1}
              onClick={() => {
                const next = [...levels];
                [next[index], next[index + 1]] = [next[index + 1], next[index]];
                setLevels(next);
              }}
            >
              Up
            </button>
            <button
              type="button"
              aria-label={`Remove level ${index + 1}`}
              onClick={() => setLevels(levels.filter((_, i) => i !== index))}
            >
              Remove
            </button>
          </div>
        ))}
        <button type="button" onClick={() => setLevels([...levels, { text: "", connector: "" }])}>
          Add level
        </button>
      </section>

      <label htmlFor="why">Why it matters</label>
      <input
        id="why"
        value={doc.summary.whyItMatters}
        onChange={(e) => withSummary({ ...doc.summary, whyItMatters: e.target.value })}
      />

      {missing.length === 0 ? null : (
        <ul className="missing" data-testid="missing-list">
          {missing.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}

      <button
        type="button"
        disabled={missing.length > 0}
        onClick={() => {
          const next: ArcDoc = { ...doc, markedComplete: true };
          onChange({ ...next, status: deriveStatus(next) });
        }}
      >
        Mark complete
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `npx vitest run src/components/SummarizeView.test.tsx`
Expected: PASS, 10 tests.

- [ ] **Step 5: Render it in the workspace**

In `src/components/ArcWorkspace.tsx`:

```tsx
{tab === "summarize" ? <SummarizeView doc={doc} onChange={edit} /> : null}
```

- [ ] **Step 6: Run the gate, build, and commit**

```bash
npm run gate && npm run build
git add src/components/SummarizeView.tsx src/components/SummarizeView.test.tsx src/components/ArcWorkspace.tsx
git commit -m "feat: summarize screen with levels and the completion gate"
```

---

### Task 21: The Playwright flow

One flow, two projects: a desktop mouse and an iPad with touch. The passage is Piper's Romans 12:1-2 and nothing else ever goes in a fixture.

**Files:**
- Create: `playwright.config.ts`, `e2e/arc.spec.ts`
- Test: `e2e/arc.spec.ts` is itself the test.

**Interfaces:**
- Consumes: `PIPER_ROMANS_REFERENCE`, `PIPER_ROMANS_TEXT`, `PIPER_SPLIT_WORDS` from `src/fixtures/piperRomans.ts`; `E2E_PASSWORD` from `src/server/session.ts`; every `data-` hook from Tasks 17 to 20.
- Produces: `npm run e2e`, green on both projects.

- [ ] **Step 1: Write `playwright.config.ts`**

Madori's config, with this app's two projects and its own dev-only environment:

```ts
// Playwright harness: @playwright/test pinned exact, retries 0, and a
// webServer running `npm run dev` so the dev-only APP_E2E_AUTH gate is
// available (it double gates on NODE_ENV === "development", which next dev
// sets on its own, so it is dead in the standalone build).
//
// DATA_DIR is a fresh temp directory per run, so the flow never touches
// Drew's real arcs and never depends on what a previous run left behind.
//
// workers 1 and fullyParallel false: both projects drive the SAME dev server
// and the SAME DATA_DIR, and the flow creates an arc whose id is derived
// from today's date plus the reference. Running them at once would race on
// the id collision suffix.
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}`;
const E2E_DATA_DIR = mkdtempSync(path.join(tmpdir(), "arcing-e2e-"));

export default defineConfig({
  testDir: "./e2e",
  retries: 0,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: BASE_URL,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
    {
      // 1024x768 with touch. The spec's iPad Safari target; Playwright runs
      // this preset on WebKit, which is the point of having it.
      name: "ipad",
      use: { ...devices["iPad Mini landscape"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      APP_E2E_AUTH: "1",
      SESSION_SECRET: "e2e-only-not-a-real-secret",
      DATA_DIR: E2E_DATA_DIR,
    },
  },
});
```

- [ ] **Step 2: Write the flow**

`e2e/arc.spec.ts`:

```ts
// The one end to end flow (design spec, Testing). Real browser, retries 0,
// no jsdom. It builds John Piper's own arc of Romans 12:1-2 (Biblical
// Exegesis pp. 21-23) exactly as he prints it: Negative-Positive over 2a and
// 2b, Action-Purpose over that pair and 2c with 2c circled, Action-Purpose
// over 12:1 and that whole unit with 12:1 circled.
//
// Never put a passage Drew arcs himself in a fixture. Ephesians is his own
// weekly series.
import { expect, test } from "@playwright/test";
import { PIPER_ROMANS_REFERENCE, PIPER_ROMANS_TEXT, PIPER_SPLIT_WORDS } from "../src/fixtures/piperRomans";
import { E2E_PASSWORD } from "../src/server/session";

const SAVED = { timeout: 15_000 };
const MAIN_POINT = "Be transformed so that you present your bodies to God.";

test("split, relate and summarize Piper's Romans 12:1-2 arc", async ({ page }) => {
  // Login. Every page but /login is behind the cookie, so / redirects here.
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("Password").fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/$/);

  // New arc, pasted.
  await page.getByRole("button", { name: "New arc" }).click();
  await page.getByRole("tab", { name: "Paste" }).click();
  await page.getByLabel("Reference").fill(PIPER_ROMANS_REFERENCE);
  await page.getByLabel("Passage text").fill(PIPER_ROMANS_TEXT);
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page).toHaveURL(/\/a\/[^/]+\/split$/);
  const arcUrl = page.url();

  // The licence notice rides under the passage.
  await expect(page.getByTestId("esv-notice")).toContainText("Used by permission.");
  await expect(page.getByRole("link", { name: "ESV" })).toHaveAttribute("href", "https://www.esv.org");

  // Split into Piper's four propositions.
  for (const phrase of PIPER_SPLIT_WORDS) {
    await page.locator(`[data-word-start="${PIPER_ROMANS_TEXT.indexOf(phrase)}"]`).click();
  }
  await expect(page.locator("[data-proposition]")).toHaveCount(4);
  await expect(page.getByTestId("save-chip")).toHaveText("Saved", SAVED);

  // Relate, bottom up.
  await page.getByRole("tab", { name: "Relate" }).click();
  await expect(page.locator("[data-prop]")).toHaveCount(4);

  await page.locator('[data-prop="p2"]').click();
  await page.locator('[data-prop="p3"]').click();
  await page.locator('[data-rel="NegPos"]').click();
  await expect(page.locator("[data-arc]")).toHaveCount(1);

  await page.locator('[data-arc="a1"]').click();
  await page.locator('[data-prop="p4"]').click();
  await page.locator('[data-rel="AcPur"]').click();
  await page.locator('[data-circle="a2:1"]').click();
  await expect(page.locator('[data-circle="a2:1"]')).toHaveAttribute("data-circled", "true");

  await page.locator('[data-prop="p1"]').click();
  await page.locator('[data-arc="a2"]').click();
  await page.locator('[data-rel="AcPur"]').click();
  await page.locator('[data-circle="a3:0"]').click();
  await expect(page.locator('[data-circle="a3:0"]')).toHaveAttribute("data-circled", "true");
  await expect(page.locator("[data-arc]")).toHaveCount(3);
  await expect(page.getByTestId("save-chip")).toHaveText("Saved", SAVED);

  // Summarize.
  await page.getByRole("tab", { name: "Summarize" }).click();
  await page.getByLabel("Main point").fill(MAIN_POINT);
  await page.getByRole("button", { name: "Add level" }).click();
  await page.getByLabel("Level 1").fill("God's mercies are the ground of the appeal.");
  await page.getByLabel("Why it matters").fill("It reframes obedience as worship.");
  await page.getByRole("button", { name: "Mark complete" }).click();
  await expect(page.getByTestId("save-chip")).toHaveText("Saved", SAVED);

  // The series row carries the main point, and the arc reopens intact.
  await page.goto("/");
  const row = page.getByRole("button", { name: new RegExp(MAIN_POINT.slice(0, 20)) }).first();
  await expect(row).toContainText("complete");
  await row.click();
  await expect(page).toHaveURL(/\/a\/[^/]+\/split$/);
  await expect(page.locator("[data-proposition]")).toHaveCount(4);

  await page.goto(arcUrl.replace("/split", "/relate"));
  await expect(page.locator("[data-arc]")).toHaveCount(3);
  await expect(page.locator('[data-circle="a3:0"]')).toHaveAttribute("data-circled", "true");
});
```

- [ ] **Step 3: Run the flow and watch it fail on the first real gap**

Run: `npm run e2e`
Expected on a first run: it may fail. Every failure here is a real integration gap, not a test to soften. Work them one at a time:
- A click that lands on the wrong element means a hit target is too small or is painted underneath another one. Fix the SVG, not the test.
- A save chip stuck on "Unsaved" means the workspace is not calling `autosave.changed` on that edit path.
- A 401 means the cookie was refused: the dev server must be running with `APP_E2E_AUTH=1`, which drops the `Secure` attribute so `http://localhost` can hold the cookie.

- [ ] **Step 4: Run it green on both projects**

Run: `npm run e2e`
Expected: PASS, 2 passed (chromium, ipad).

- [ ] **Step 5: Run the whole gate once**

Run: `npm run gate && npm run build && npm run e2e`
Expected: tsc clean, eslint clean, every vitest file passing, a standalone build, both e2e projects green.

- [ ] **Step 6: Commit**

```bash
git add playwright.config.ts e2e/arc.spec.ts
git commit -m "test: end to end flow building Piper's Romans 12:1-2 arc"
```

---

### Task 22: Deploy files and the kick-off checklist

These tasks produce FILES. They do not run anything on the box. The orchestrating session applies them as root after Drew's own steps in `KICKOFF.md`.

**Files:**
- Create: `deploy/arcing.service`, `deploy/Caddyfile.arcing`, `deploy/backup-additions.md`, `.github/workflows/deploy-box.yml`, `KICKOFF.md`
- Modify: `README.md` (point at `deploy/` and `KICKOFF.md`)

**Interfaces:**
- Consumes: `memory/vultr_box.md` conventions and madori's shipped workflow.
- Produces: everything needed to stand the app up on 155.138.231.13 at `arcing.bushidoacquisitions.com`, port 3006.

- [ ] **Step 1: Write the systemd unit**

`deploy/arcing.service`. Install as `/etc/systemd/system/arcing.service`.

```ini
[Unit]
Description=arcing
After=network.target

[Service]
Type=simple
User=deploy
Group=deploy
WorkingDirectory=/srv/deploy/arcing/current
EnvironmentFile=/srv/deploy/arcing/.env
Environment=NODE_ENV=production
Environment=PORT=3006
Environment=HOSTNAME=127.0.0.1
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/srv/deploy/arcing/data

[Install]
WantedBy=multi-user.target
```

`HOSTNAME=127.0.0.1` keeps the standalone server on loopback, which is what every other app on this box does; Caddy is the only thing that talks to it.

- [ ] **Step 2: Write the Caddy vhost**

`deploy/Caddyfile.arcing`. Append to `/etc/caddy/Caddyfile`, then `caddy validate --config /etc/caddy/Caddyfile && systemctl reload caddy`.

```
arcing.bushidoacquisitions.com {
	encode gzip

	reverse_proxy 127.0.0.1:3006 {
		# Next standalone Route Handlers build absolute redirects from the
		# internal bind address and ignore Host and X-Forwarded-Host. Every
		# new app on this box needs this rewrite (memory/vultr_box.md).
		header_down Location "^https?://(localhost|127\.0\.0\.1):3006" "https://arcing.bushidoacquisitions.com"
	}
}
```

No SSE anywhere in this app, so `encode` needs no path exclusion. There is no www variant; this is a subdomain, matching madori.

- [ ] **Step 3: Write the backup additions note**

`deploy/backup-additions.md`. The box's nightly job (03:30 ET, 14-day retention, rclone to the `gdrive-personal` remote's `pg/` folder) is confirmed in `memory/vultr_box.md`, but its script path, sweep and rclone filters are recorded nowhere, so they get read on the box at kick-off before anything is edited.

```markdown
# Backup additions for arcing

The arcs are files, not rows, so the nightly Postgres dump does not cover them.
Three lines, mirroring banso's file-data backup (banso/mirror/docs/deploy.md).

Read the real script first, then edit it. Never rewrite it.

    ssh -i ~/.ssh/vultr_box root@155.138.231.13 "systemctl cat pg-backup.service"
    ssh -i ~/.ssh/vultr_box root@155.138.231.13 "cat <the ExecStart script path that prints>"

1. In the backup script, beside the pg_dump lines:

    tar czf "$BACKUP_DIR/arcing-data-$(date +%F).tar.gz" -C /srv/deploy/arcing data

2. In the same script's retention sweep, include the new tarball in whatever
   pattern the existing dumps use (14-day retention, same as the dumps).

3. In the rclone filter list, add an include for the tarball so it reaches the
   gdrive-personal remote alongside the suke and carnet dumps.

Verify the night after: the tarball exists locally, and it exists offsite.
```

- [ ] **Step 4: Write the deploy workflow**

`.github/workflows/deploy-box.yml`, madori's file with the path and service renamed:

```yaml
name: Deploy to box

on:
  push:
    branches: [main]
  workflow_dispatch:

concurrency:
  group: deploy-box
  cancel-in-progress: false

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - run: npm ci

      - run: npm run build

      - name: Assemble standalone bundle
        run: |
          cp -r .next/static .next/standalone/.next/static
          cp -r public .next/standalone/public

      - name: Ship to box and restart
        env:
          SSH_KEY: ${{ secrets.BOX_SSH_KEY }}
          KNOWN_HOSTS: ${{ secrets.BOX_KNOWN_HOSTS }}
        run: |
          mkdir -p ~/.ssh
          printf '%s\n' "$SSH_KEY" > ~/.ssh/id_ed25519
          chmod 600 ~/.ssh/id_ed25519
          printf '%s\n' "$KNOWN_HOSTS" >> ~/.ssh/known_hosts
          rsync -az --delete .next/standalone/ deploy@155.138.231.13:/srv/deploy/arcing/current/
          ssh deploy@155.138.231.13 'sudo systemctl restart arcing'
```

The bundle step copies `public/`, so the repo needs one. Create `public/.gitkeep` if it does not exist, or the workflow's `cp -r public` fails.

- [ ] **Step 5: Write `KICKOFF.md`**

```markdown
# Kick-off checklist

Everything here is a human step or a step that touches the box. The build
tasks in `docs/superpowers/plans/` never do any of it.

## 1. Name the app

arcing is a literal placeholder in every file. One pass resolves it. The
environment variable names APP_PASSWORD_HASH and APP_E2E_AUTH are NOT
placeholders and this replace does not touch them.

    NAME=<the chosen name>
    grep -rl arcing . --exclude-dir=node_modules --exclude-dir=.git \
      | xargs sed -i '' "s/arcing/$NAME/g"
    git mv deploy/arcing.service "deploy/$NAME.service"
    git mv deploy/Caddyfile.arcing "deploy/Caddyfile.$NAME"
    grep -rn arcing . --exclude-dir=node_modules --exclude-dir=.git

The last command must print nothing.

## 2. Create the public repo

    gh repo create "dhendy11/$NAME" --public --source=. --remote=origin --push

## 3. DNS at Porkbun

Add an A record: `$NAME.bushidoacquisitions.com` to `155.138.231.13`. Porkbun
is the registrar and the DNS host for bushidoacquisitions.com. Until it
resolves, verify on the box over loopback:

    ssh -i ~/.ssh/vultr_box root@155.138.231.13 "curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3006/login"

## 4. Confirm port 3006 is free

    ssh -i ~/.ssh/vultr_box root@155.138.231.13 "ss -ltnp | grep ':3006' || echo 'free'"

Expected: `free`. Taken already: 3001 carnet, 3002 skidmarks, 3003 suke,
3004 banso, 3005 madori.

## 5. Read the sudoers deploy line, then EXTEND it

Its contents are recorded nowhere. Read it, then add this app's restart to the
existing list. Never replace the line.

    ssh -i ~/.ssh/vultr_box root@155.138.231.13 "grep -rn deploy /etc/sudoers.d/ /etc/sudoers"
    ssh -i ~/.ssh/vultr_box root@155.138.231.13 "visudo -c"

The line must end up allowing `/usr/bin/systemctl restart $NAME` alongside
whatever it already allows.

## 6. Read the backup script, then add the three lines

See `deploy/backup-additions.md`. Read first, edit second.

## 7. The ESV API key

Drew creates it at https://api.esv.org/account/create-application/ under his
own account, on the free non-commercial terms.

## 8. Write the env file

    ssh -i ~/.ssh/vultr_box root@155.138.231.13
    mkdir -p /srv/deploy/$NAME/{current,data}
    chown -R deploy:deploy /srv/deploy/$NAME
    install -o root -g deploy -m 640 /dev/null /srv/deploy/$NAME/.env

Its contents:

    APP_PASSWORD_HASH=<npm run hash-password, on Drew's Mac>
    SESSION_SECRET=<openssl rand -base64 32>
    ESV_API_KEY=<from step 7>
    DATA_DIR=/srv/deploy/$NAME/data

APP_E2E_AUTH is never set here. It is dev only and double gated on NODE_ENV.

## 9. The deploy key and the two GitHub secrets

    ssh-keygen -t ed25519 -f ~/.ssh/${NAME}_deploy -N "" -C "$NAME deploy"
    ssh -i ~/.ssh/vultr_box root@155.138.231.13 \
      "cat >> /srv/deploy/.ssh/authorized_keys" < ~/.ssh/${NAME}_deploy.pub
    gh secret set BOX_SSH_KEY < ~/.ssh/${NAME}_deploy
    ssh-keyscan -H 155.138.231.13 | gh secret set BOX_KNOWN_HOSTS

## 10. Install the unit and the vhost

Diff the unit against the one already running before installing it, so this
app matches the box rather than this plan's best guess:

    ssh -i ~/.ssh/vultr_box root@155.138.231.13 "cat /etc/systemd/system/madori.service"

Then:

    scp -i ~/.ssh/vultr_box deploy/$NAME.service root@155.138.231.13:/etc/systemd/system/
    ssh -i ~/.ssh/vultr_box root@155.138.231.13 "systemctl daemon-reload && systemctl enable --now $NAME && systemctl status $NAME --no-pager"
    ssh -i ~/.ssh/vultr_box root@155.138.231.13 "cat >> /etc/caddy/Caddyfile" < deploy/Caddyfile.$NAME
    ssh -i ~/.ssh/vultr_box root@155.138.231.13 "caddy validate --config /etc/caddy/Caddyfile && systemctl reload caddy"

## 11. Prove it

    curl -sS -o /dev/null -w '%{http_code}\n' https://$NAME.bushidoacquisitions.com/login

Expected: 200. Then sign in with the real password, create one arc from the
Fetch tab (which proves the ESV key), and confirm a JSON file appears:

    ssh -i ~/.ssh/vultr_box root@155.138.231.13 "ls -la /srv/deploy/$NAME/data/arcs"

## What this app never does

It never writes to the EA repo. The Saturday EA session reads
`GET /api/arcs` and appends the date, passage and main point to
`logs/journal.md` itself.
```

- [ ] **Step 6: Commit**

```bash
git add deploy .github/workflows/deploy-box.yml KICKOFF.md README.md public/.gitkeep
git commit -m "chore: deploy unit, Caddy vhost, deploy workflow and kick-off checklist"
```

---

## Decisions this plan had to make

The spec is the authority. Where it was silent or where two of its own lines pulled apart, this plan
ruled, and the ruling is here rather than buried in a task. Anything on this list is open to being
overruled at kick-off; nothing on it is a licence to improvise past the spec elsewhere.

1. **`markedComplete` is a stored field.** The spec derives `complete` from "once Mark complete
   succeeded AND its conditions still hold". Two things, so the first one has to be remembered. The
   document gains one boolean; every other field in the spec's JSON is untouched.
2. **`Geometry` gains `leaves` and `baseline`.** The spec pins `{width, height, props, arcs}` and
   those four are exactly as written. Mockup A also draws one arc over every proposition and a
   ticked baseline, which are geometry and must not be recomputed inside a React component. They are
   added as two new fields rather than by changing the four.
3. **An arc's one symbol sits in the arc's own lane, at the arc's vertical midpoint.** Piper's paper
   convention splits a relationship's lettering across its two members (Ac over one, Pu over the
   other), which needs two symbols per arc. The spec's `Geometry` gives one `sym` per arc plus a
   `circles` array, and its own sentence says "bold symbol at the arc's vertical midpoint", so the
   spec's shape wins. Every circle position still matches mockup A to the pixel; only the lettering
   sits one lane further out than the mockup draws it.
4. **Proposition numbers are 1..n.** The spec says propositions renumber 1..n; the mockup prints
   Piper's own list labels (12:1, 12:2a). The spec wins.
5. **Passage text is whitespace-normalised once, at creation.** Propositions index into that string,
   the ESV API returns hard-wrapped paragraphs, and a paste can carry anything. Normalising later
   would move every boundary.
6. **A pasted passage stores `verses: []`.** The spec defines marker parsing only for the ESV API
   response. No verse badges on a pasted arc, which is what the e2e flow exercises.
7. **Arc ids never come back.** `a1` is not reissued after `a1` is dissolved. Undo, autosave and the
   e2e selectors all read better when an id means one thing forever.
8. **Dissolving an arc dissolves the arcs above it.** The spec gives this rule for split and rejoin
   and is silent for dissolve, but the reason is the same: a parent cannot survive losing a member.
   The Relate screen names which arcs come apart before it happens.
9. **`APP_E2E_AUTH` replaces the password HASH, not the session.** The spec calls it a "dev-only
   bypass"; read as bypassing the cookie it would make the flow's login step meaningless. It also
   drops the cookie's `Secure` attribute, because Playwright drives `http://localhost` and WebKit
   (the iPad project) refuses a Secure cookie over http. Both are double gated on
   `NODE_ENV === "development"`, which the standalone build pins to production.
10. **Arc ids are dated in America/New_York.** A Saturday-night arc must not be filed under Sunday
    because UTC rolled over. The box already runs that timezone.
11. **Amber is `#b45309`.** The spec asks for an amber ring on a missing circle and names no hex. It
    is the one colour value not taken from the spec, and it is in `tokens.ts` with the other four.
12. **`LayoutMode` has one value in v1.** The spec's Testing section says "layout() in both modes",
    and its Frontend section rules later the same day that only `stacked` is built. The later ruling
    wins; adding `biblearc` is one branch behind the same signature.
13. **`canRelabel` is separate from `canRelate`.** Relabelling asks only about member count: an
    arc's members are adjacent by construction and are not top level when the arc has a parent.
14. **The login limiter is in-process memory.** One user, one process. A restart forgiving five
    attempts is not a risk worth a file for.
15. **The systemd unit is written from the box's conventions, not copied.** `madori.service` exists
    only on the box; no repo holds it. `KICKOFF.md` step 10 prints the running unit and diffs it
    before installing this one.
16. **`ArcWorkspace` has no component test.** Every branch it holds is already covered: the timing
    and error states by the autosave engine tests, the banners by the frame tests, the happy path by
    Playwright. A test there would mock the whole world and prove nothing.

## Self-review

**Spec coverage.** Every section of the design spec, and where it lands.

| Spec | Task |
|---|---|
| Frame: series link, reference, tabs, save state, Undo, Redo | 16 |
| ESV notice under any view showing passage text | 1 (string), 16 (component), 21 (flow) |
| 44 px targets, 17 px type, the four colours, sans chrome and serif passage | 1, 18 |
| Login screen and its one error line | 8, 11, 14 |
| Series list, empty state, createdAt order, New arc sheet, 503 to Paste | 10, 11, 15 |
| Split screen: words, verse badges, split, rejoin, renumber, dissolve confirm, Piper's rules | 5, 17 |
| Relate screen: selection, palette of 18 under four headings, definitions, p. 34 warning, circles, relabel, dissolve, member counts, Summarize gate | 2, 6, 16, 18, 19 |
| Summarize: main point, levels with connectors, topmost connector hidden, why it matters, Mark complete gating | 4, 20 |
| Data model, slug, collision suffix, tiling, forest, circled index, derived status, validateDoc | 3, 4, 5, 6 |
| The 18 relationship codes with the primer's symbols and definitions | 2 |
| Backend: login, logout, arcs list, create, get, put, 409, force, validation | 8, 10, 11 |
| ESV fetch, its exact parameters, the marker parser, the 8 s timeout, 503 | 9 |
| Disk layout and the env file | 10, 22 |
| Layout function, Geometry, one SVG component with hit targets | 7, 18 |
| Undo: 200 steps, all three screens, buttons plus Cmd and Ctrl-Z, cleared on leaving | 12, 16, 17 |
| Autosave: 1 s debounce, 5 s throttle, visibilitychange flush, localStorage mirror | 13, 17 |
| Error handling: 409 banner, 401 modal, offline backoff | 13, 16, 17 |
| Unit, component and Playwright test lists | 2 to 21 |
| Deployment: unit, Caddy vhost, port 3006, workflow, sudoers, backups, DNS | 22 |

**Gaps, named rather than hidden.**
- The `biblearc` layout mode is not built. That is the spec's own 11:55 ruling, not an omission.
- The journal append is not in the app at all. The spec puts it in the Saturday EA session, which
  reads `GET /api/arcs`. Nothing here writes to the EA repo.
- The backup lines, the sudoers line, the DNS record and the ESV key are produced as files and
  commands in `KICKOFF.md`, not applied. Task 22 touches nothing on the box, by instruction.
- The spec's storage term (500 verses, or half a book) is named in the spec and not enforced in v1.
  No task enforces it. At roughly 8 verses a Saturday it binds near 60 arcs, which is the spec's own
  arithmetic and a v2 problem.

**Placeholder scan.** No task contains TBD, TODO, "implement later", "add appropriate error
handling", "similar to Task N", or a test described without its code. Every code step carries the
real code, every run step carries the exact command and the expected result.

**Type consistency.** Names used across task boundaries, checked against where they are defined:
`ArcDoc`, `ArcNode`, `ArcStatus`, `ArcSummary`, `Member`, `Level`, `Summary`, `Proposition`, `Verse`,
`Passage` (Task 3, with `ArcSummary` moved into `types.ts` in Task 13); `RelCode`, `RelGroup`,
`Relationship`, `RELATIONSHIPS`, `GROUP_ORDER`, `GROUP_HEADINGS`, `relationship`, `CIRCLING_CODES`,
`NEG_POS_SYMBOL` (Task 2); `topLevelUnits`, `propIndexRange`, `propsUnder`, `unitLevel`, `isRooted`,
`memberKey`, `arcById`, `ancestorsOfProp`, `ancestorsOfArc` (Task 3); `completionMissing`,
`deriveStatus` (Task 4); `validateDoc`, `Violation`, `isWordStart` (Task 4); `wordStarts`, `splitAt`,
`rejoinAt`, `arcsDissolvedBySplit`, `arcsDissolvedByRejoin`, `propositionAt` (Task 5); `canRelate`,
`canRelabel`, `createArc`, `relabelArc`, `dissolveArc`, `setCircled`, `arcsDissolvedByDissolve`,
`Fit` (Task 6); `layout`, `LAYOUT`, `wrapLines`, `Geometry`, `PropBox`, `ArcShape`, `LeafShape`,
`ArcCircle`, `Baseline`, `LayoutMode` (Task 7); `hashPassword`, `verifyPassword`, `signSession`,
`verifySession`, `sessionSetCookie`, `sessionClearCookie`, `hasValidSession`, `passwordAccepted`,
`isE2eAuthActive`, `E2E_PASSWORD`, `SESSION_COOKIE`, `SESSION_MAX_AGE_S` (Task 8); `fetchPassage`,
`parsePassage`, `ESV_PARAMS`, `EsvUnavailableError` (Task 9); `arcsDir`, `isSafeArcId`, `listArcIds`,
`readArc`, `writeArc`, `listSummaries` (Task 10); `guardDecision`, the seven `httpErrors` helpers and
the four route modules (Task 11); `useArcStore`, `SaveState`, `UNDO_LIMIT`, `undo`, `redo`,
`clearHistory`, `historyDepth`, `canUndo`, `canRedo` (Task 12); `SaveResult`, `putArc`, `getArc`,
`listArcs`, `createArc` (the API one, imported as `createArc` from `@/client/api` only in
`NewArcSheet`, while the core one of the same name is imported from `@/core/arcTree` in `RelateView`;
no file imports both), `createAutosave`, `localStorageMirror`, `mirrorKey`, `DEBOUNCE_MS`,
`THROTTLE_MS`, `OFFLINE_BACKOFF_MS` (Task 13); `LoginForm` (14); `SeriesList`, `NewArcSheet` (15);
`ArcFrame`, `ArcTab`, `SaveChip`, `EsvNotice` (16); `SplitView`, `ArcWorkspace` (17); `ArcSvg` (18);
`Palette`, `RelateView` (19); `SummarizeView` (20); `PIPER_ROMANS_TEXT`, `PIPER_ROMANS_REFERENCE`,
`PIPER_SPLIT_WORDS`, `piperRomansDoc` (7, used again in 18, 19, 20, 21).

One name collision exists and is deliberate: `createArc` is both the core operation
(`@/core/arcTree`) and the API call (`@/client/api`). They never appear in the same file. If that
ever changes, rename the API one to `createArcOnServer` rather than aliasing at the import.

## Execution handoff

Plan complete. Two execution options:

1. **Subagent-Driven (recommended)** - a fresh subagent per task, reviewed between tasks. Use
   `superpowers:subagent-driven-development`.
2. **Inline Execution** - tasks executed in one session with checkpoints. Use
   `superpowers:executing-plans`.

Tasks 1 to 20 are strictly sequential: each one's Interfaces block names what the previous ones
produced. Task 21 needs everything before it. Task 22 touches no code and can run at any point after
Task 1.
