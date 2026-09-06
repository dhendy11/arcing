# APP_NAME design spec

Drafted 2026-09-05 from `one-pager.md`, whose rulings are fixed and not reopened here. Relationships, circling and levels come from `references/personal/bible-arcing-primer.md`, Piper's pages from https://cdn.desiringgod.org/pdf/booklets/BTBX.pdf.

## Purpose

A single-user web tool for the Saturday arcing practice: split a passage into propositions, relate them with Piper's 18 relationships until one arc spans the passage, write the summary. It records what Drew does; it never draws, splits, labels or suggests. Every arc is a dated JSON file on his own box, readable as a series. Standalone public open-source repo, Drew's use only, built by subagents unattended, so every requirement below is testable and every interface explicit.

## Screens

Frame on every screen: series link, reference, tabs (Split, Relate, Summarize), save state (Saved / Saving / Unsaved / Offline / Conflict), Undo, Redo. Any view showing passage text carries the ESV notice beneath it, "ESV" linked to https://www.esv.org (licence condition, Backend). Touch targets 44 px minimum, base type 17 px; every target works with a mouse, so "tap" means tap or click. Colour and type, one reading, no substitutions (Kole Jain): paper `#faf8f5`, ink `#1c1917`, accent `#1d4ed8` on selection and active state, `#b91c1c` only on destructive controls, sans chrome, serif passage text.

**Login (`/login`).** The only route outside the cookie. Password field, Sign in; a wrong password shows one line under it; success redirects to `/`.

**Series list (`/`).** Arcs by `createdAt` newest first (date, reference, status, main point); tap New arc or a row. Empty state: the one line "No arcs yet. Start one." New arc sheet, two tabs: Fetch (reference only, POSTs `/api/arcs` with no `text`, server resolves the passage) and Paste (reference plus textarea, POSTs both). Success opens Split; on a 503 the sheet shows "ESV unavailable, paste the text" and switches to Paste.

**Split (`/a/:id/split`).** The passage reads as words, verse numbers as badges; a new arc starts as one proposition covering all of it. Tap a word: a new proposition starts there. Tap a divider bar: the two rejoin. Propositions renumber 1..n and boundaries land only on word starts. Piper's split rules sit beside the text as static reference (relative clauses stay inside, p. 27; asserting participles and infinitives split out, p. 28), never applied. Hover shows a caret before the word, dividers are bars with an X. A split or rejoin dissolves every arc holding the affected proposition, directly or through a nested member, after a confirm modal listing them.

**Relate (`/a/:id/relate`).** Tap top-level units (propositions or parentless arcs) to select; adjacent units open the palette, showing all 18 under four headings (coordinate, then Piper's three subordinate groups: restatement, distinct statement, contrary statement), each with its one-line definition, Ground and Inference carrying the p. 34 warning. Pick one and the arc draws. Tap an arc's label to relabel or dissolve it (members return to top level). Ac-Pur, Ac-Res and Sit-R, the only three that circle (p. 22), put a circle target on each of their two members: tap one to circle it, the other to move it. Member order always follows the passage, so there is no reordering control. Member counts are the ones listed under Data model; non-adjacent selection keeps the palette closed ("Select neighbours"); one top-level unit covering every proposition enables Summarize. Selected units tinted, unfit rows disabled with the reason, circled member ringed, missing circle amber.

**Summarize (`/a/:id/summarize`).** Type the main point (one sentence), the levels bottom to top with a connector between each (Piper p. 24; `levels[0]` is the bottom, each row text plus the connector into the level above; add, remove, reorder), the why-it-matters line, then Mark complete. Nothing is prefilled; the topmost level has nothing above it, so its connector field is hidden and stored as `""`. Mark complete requires a non-empty main point, one level with non-empty text and every required circle, otherwise it is disabled and lists what is missing. Complete arcs stay editable.

## Data model

One file per arc: `data/arcs/<id>.json`, id `YYYY-MM-DD-<reference-slug>`.

```json
{ "schemaVersion": 1, "id": "2026-09-05-ephesians-2-8-10", "rev": 14,
  "createdAt": "...", "updatedAt": "...", "status": "split | relating | complete",
  "passage": { "reference": "Ephesians 2:8-10", "canonical": "Ephesians 2:8-10",
    "translation": "ESV", "source": "esv-api | paste", "fetchedAt": "...",
    "text": "For by grace ...", "verses": [{ "n": 8, "start": 0 }] },
  "propositions": [{ "id": "p1", "start": 0, "end": 47, "text": "For by grace ..." }],
  "arcs": [{ "id": "a1", "kind": "arc", "rel": "G", "circled": null,
    "members": [{ "kind": "prop", "ref": "p1" }, { "kind": "prop", "ref": "p2" }] }],
  "summary": { "mainPoint": "", "levels": [{ "text": "", "connector": "therefore" }],
    "whyItMatters": "" } }
```

- `<reference-slug>`: reference lowercased, runs of non-alphanumerics replaced by one hyphen, outer hyphens dropped; on collision append `-2`, then `-3`, and so on.
- `status` is derived on every save, never typed: `complete` when `markedComplete` is true and the Mark complete conditions still hold, else `relating` if any arc exists, else `split`. `markedComplete` (boolean, set by Mark complete, cleared when its conditions stop holding) is stored on the doc; added 2026-09-05 at plan-writing because the rule is uncomputable without it.
- `propositions` tile `passage.text`: ordered, non-overlapping, every non-whitespace character covered, `start` on a word start.
- `arcs` is a forest of top-level nodes in passage order; leaves are `{kind:"prop", ref}`; every proposition appears once; members are adjacent and in passage order.
- `circled` is a 0-based member index for `AcPur`, `AcRes`, `SitR`, else `null`. `summary.levels[].connector` is free text, `""` on the topmost level.
- `validateDoc(doc)` returns violations; the server rejects any PUT carrying one.

The 18 `rel` codes live in `src/core/relationships.ts` with the primer's section (b) symbols and definitions copied verbatim (Piper pp. 12-19). Coordinate, 2 or more members: `S` Series, `P` Progression, `A` Alternative. Restatement, 2: `AcMn` Ac/Mn, `Cf` Comparison, `NegPos` -/+, `IdExp` Id/Exp, `QA` Q/A. Distinct statement, 2 except `BL` which takes exactly 3: `G` Ground, `Inf` therefore-sign Inference, `BL` Bilateral, `AcRes` Ac/Res, `AcPur` Ac/Pur, `IfTh` If/Th, `T` Temporal, `L` Locative. Contrary, 2: `Csv` Concessive, `SitR` Sit/R.

## Backend

Next.js Route Handlers under `src/app/api/`, JSON, all behind the cookie except login.

- POST `/api/login` `{password}`: scrypt-compare against `APP_PASSWORD_HASH`; sets `app_session`, an HMAC-SHA256 over an expiry keyed by `SESSION_SECRET` (httpOnly, Secure, SameSite=Lax, 30 days); 5 tries a minute per IP, then 429. `/api/logout` clears it.
- GET `/api/arcs`: `[{id, reference, status, createdAt, updatedAt, mainPoint}]` newest first.
- POST `/api/arcs` `{reference, text?}`: `text` given means `source:"paste"`; `text` absent means the server fetches from api.esv.org (below) as `source:"esv-api"`, a failure returning 503 with no file written. Creates one proposition covering the text, returns the doc.
- GET `/api/arcs/:id`: the doc.
- PUT `/api/arcs/:id`: body is the doc at its loaded `rev`; 409 plus the server doc when `rev` differs unless `?force=1`; validates; temp file then rename; bumps `rev`, `updatedAt`.

ESV fetch, server-side only and reached solely through POST `/api/arcs`, so no browser-facing route exists and the key never reaches the browser: `GET https://api.esv.org/v3/passage/text/?q=...`, header `Authorization: Token <ESV_API_KEY>`, parameters `include-headings=false&include-footnotes=false&include-passage-references=false&include-short-copyright=false&include-verse-numbers=true&indent-paragraphs=0&indent-poetry=false&line-length=0`. The server parses the inline `[n]` markers out of `passages[0]` into `verses` and writes `{canonical, text, verses}` into the arc doc, the only stored copy. 8 s timeout, any failure 503 `{error:"esv_unavailable"}`.

Verified 2026-09-05 at https://api.esv.org/ and /docs/passage-text/ (fields `canonical`, `passages`, verse numbers inline as `[35]`): free "for non-commercial use", 500 verses per query, "You may not locally store more than 500 verses or one-half of any book", and every page using the text links to www.esv.org, marks it "(ESV)" and shows "Scripture quotations are from the ESV® Bible (The Holy Bible, English Standard Version®), © 2001 by Crossway, a publishing ministry of Good News Publishers. Used by permission. All rights reserved." Key created at /account/create-application/. The storage term is named, not enforced in v1: each arc keeps its own text, so it binds near 60 arcs [arithmetic on the quoted 500 at roughly 8 verses a Saturday].

Journal: the tool never writes to the EA repo; the Saturday EA session reads `GET /api/arcs` and appends date, passage and main point to `logs/journal.md`, needing no credential on the box.

Disk (`DATA_DIR`): `arcs/` only, pretty-printed JSON. Env (`/srv/deploy/APP_NAME/.env`, root:deploy 640): `APP_PASSWORD_HASH` (`npm run hash-password`), `SESSION_SECRET`, `ESV_API_KEY`, `DATA_DIR`.

Backups: the nightly job (03:30 ET, 14-day retention, rclone to the `gdrive-personal` remote's `pg/` folder) and Vultr's weekly snapshots are confirmed in `memory/vultr_box.md` and `projects/vps-migration/README.md`. Its script path, sweep and rclone filters are recorded nowhere, so **verify on the box at kick-off**, then add three lines mirroring banso's file-data backup (`banso/mirror/docs/deploy.md`): a `tar czf` of `/srv/deploy/APP_NAME/data`, that tarball in the sweep, an include filter for it offsite.

## Frontend

Stack: **Next.js 16 standalone, React 19, TypeScript, zustand 5 + zundo 2, inline SVG, vitest + Testing Library + Playwright**, with Madori's gate (`npm run gate` = tsc + eslint + vitest; `npm run e2e` separate, retries 0). It is the one stack subagents have already shipped unattended onto this box, with deploy workflow, unit file, Caddy block and Next 16 gotchas recorded. Copy from `~/Documents/Programming/madori`: the deploy workflow, Playwright and vitest configs, `proxy.ts`, `httpErrors.ts`. No database, no Auth.js, no PGlite.

Weighed per `.claude/rules/infrastructure-planning.md`. Every candidate is zero monthly cost, self-hosted, open source and under Drew's control; the deciding constraints are unattended build reliability and fit with the box.
- Rejected, Vite React SPA plus a Hono API server: smaller, but two build artifacts, a process shape matching nothing on the box, pipeline and e2e harness unproven.
- Rejected, SvelteKit with adapter-node: lightest runtime, no precedent in Drew's repos, nothing to harvest.
- Auth.js rejected for login: SMTP and user tables for one password. Data store not weighed, JSON files are ruled.

Rendering: a pure `layout(doc, mode): Geometry`, where `Geometry = {width, height, props: {id, x, y, w, h, lines: string[]}[], arcs: {id, d, sym, labelX, labelY, circles: {memberIndex, x, y}[]}[]}`. One React component draws the SVG with hit targets (`data-prop`, `data-arc`, `data-circle`, used by tests). Nothing else sees `mode`.

**RULED 2026-09-05 11:55: `layout.mode` = `stacked` (mockup A).** `mockups/arcing-layouts.html` section A carries the exact geometry and is the authority. `biblearc` stays specified below as the second value behind the same signature, not built in v1.
- `stacked` (mockup A, Piper's paper conventions turned vertical): full-width plain-text proposition rows, number right-aligned in a 68 px gutter; one vertical baseline at the text column's right edge with ticks at boundaries, leaf arcs bulging nearest it and each enclosing arc one step further right; bold symbol at the arc's vertical midpoint, ellipsed when that member is circled; Negative-Positive as a stroke.
- `biblearc` (mockup B): the same stack in bordered cells, verse numbers at the cell's left, translation named above the column; thin arcs to the right, one step per nesting level; symbol inside the arc, coloured by group (coordinate green, restatement blue, distinct and contrary red); circled member on a light grey disc.

Build `stacked` only in v1; `biblearc` is a second function behind the same signature and tests, added when ruled. Mockup C (booklet orientation) is not in play.

Undo: zundo history, 200 steps, every edit on all three screens; buttons always visible, Cmd/Ctrl-Z extra; clears on leaving the arc.

Autosave: PUT debounced 1 s after the last change, throttled to one PUT every 5 s while editing, flushed on `visibilitychange` to hidden (iPad Safari suspends tabs). A localStorage mirror of the unsaved doc, keyed by `id` and base `rev`, offers Restore or Discard on reopen.

## Deployment on the box

Follows `memory/vultr_box.md` and madori. Files in `deploy/`, applied as root by the orchestrating session.

- `/srv/deploy/APP_NAME/` holds `current/` (rsync target), `data/`, `.env`. Port **3006** (3001-3003 per `memory/vultr_box.md`, banso 3004 per `memory/training_platform.md`, madori 3005 per `memory/madori_project.md` are taken); confirm 3006 is free on the box at kick-off.
- `deploy/APP_NAME.service`: `madori.service` renamed, `PORT=3006`, `EnvironmentFile=/srv/deploy/APP_NAME/.env`, `ReadWritePaths=/srv/deploy/APP_NAME/data`.
- Caddy vhost `APP_NAME.bushidoacquisitions.com` (no www, matching madori): `encode gzip`, `reverse_proxy 127.0.0.1:3006` with `header_down Location "^https?://(localhost|127\.0\.0\.1):3006" "https://APP_NAME.bushidoacquisitions.com"`, required of every new app by `memory/vultr_box.md`. No SSE, so no encode exclusion.
- Sudoers: add `/usr/bin/systemctl restart APP_NAME` to the `deploy` line. Its contents are recorded nowhere: **verify on the box at kick-off** and extend it, never replace it.
- `.github/workflows/deploy-box.yml`: madori's, path and service renamed; secrets `BOX_SSH_KEY`, `BOX_KNOWN_HOSTS`; a dedicated deploy key in `/srv/deploy/.ssh/authorized_keys`.
- DNS: Drew adds `APP_NAME.bushidoacquisitions.com A 155.138.231.13` at Porkbun; verify over loopback until then.

## Error handling

- Save conflict (409): banner with Reload (server copy, history cleared) or Overwrite (`?force=1`); autosave pauses until chosen.
- Session expiry (401): the doc stays in memory, an inline login modal opens, the pending save retries.
- Offline: indicator, retry at 2, 4, 8, 16 s, mirror kept current.

## Testing

- Unit (vitest): tiling invariant under any split/rejoin sequence (fast-check); adjacency, member-count and circle rules for all 18 codes; `relationships.ts` holds exactly 18 codes under four headings with the primer's definitions; root detection; dissolve-on-resplit; `validateDoc`; derived `status`; slug and collision suffix; ESV marker parser against the documented `John 11:35` fixture; cookie sign, verify, expiry; 429 on the sixth login in a minute; file rename and 409 on stale `rev`; `layout()` in both modes, non-overlapping boxes, one path per arc.
- Component (vitest, jsdom, Testing Library), one test each: wrong-password line; login routes to `/`; series empty state; series `createdAt` order; a 503 switches to Paste; ESV notice and link; word click splits; divider rejoins; resplit confirms; palette opens adjacent with 18 rows under four headings; closed non-adjacent; three selections enable only S, P, A, BL; AcPur circle targets; circle moves to the other member; G draws `data-arc`; Summarize disabled until root; the gating list; topmost connector hidden; five save-chip states; undo and redo on all three screens; 200-step cap; history cleared on leaving; autosave debounce; 5 s throttle; `visibilitychange` flush; mirror Restore or Discard; 409 banner pauses autosave; 401 modal retries the save; offline backoff 2, 4, 8, 16 s.
- Playwright, one flow, two projects: `chromium` 1280x800 with mouse, `devices["iPad Mini landscape"]` (1024x768, touch). Login, New arc, paste Romans 12:1-2, split and relate it exactly as Piper's own arc in the booklet (BTBX.pdf pp. 21-22, reproduced in `mockups/arcing-layouts.html` section A), circle the Pur member, fill main point, one level, why-it-matters, Mark complete, reload: the series row shows the main point and the arc opens intact. Fixtures never use a passage Drew arcs himself (Ephesians is his series); Piper's published arc is the only sanctioned sample. Temp `DATA_DIR`, `APP_E2E_AUTH=1` (dev-only bypass).
- Gate: targeted tests per task; one full `gate` and one `e2e` per batch.

## Out of scope (v1)

Greek/Hebrew tags, bracketing, phrasing, sharing, multi-user accounts, phone layout (iPad Safari at 1024 px is IN), Biblearc import, the four optional relationships (Both-And, General-Specific, Fact-Interpretation, Anticipation-Fulfillment), AI, other translations, PDF export, keyboard-first editing, deleting an arc (no affordance, no route), any write from the tool into the EA repo.

## Open questions (Drew)

1. The name (repo, hostname, service).

Drew's own steps before kick-off: the ESV API key (personal terms), the login password, the Porkbun A record.
