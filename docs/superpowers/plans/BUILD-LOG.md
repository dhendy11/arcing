# arcing build log

Built 2026-09-05 into 2026-09-06 by subagent-driven development against
`docs/superpowers/plans/2026-09-05-arcing-plan.md`, with
`docs/superpowers/specs/2026-09-05-arcing-design.md` as the binding authority.
All 22 tasks are done. 40 commits on `main`, pushed to
github.com/dhendy11/arcing.

Every task got a fresh implementer, then a two-stage review (spec compliance
plus code quality), then a fix round with its own scoped re-review where the
review found something. Ten tasks needed a fix round. Three needed two. The
final whole-branch review found one Critical and four Important; both its fix
waves are in.

## Gate at HEAD (`298e4c7`)

- `npm run gate` (tsc, eslint, vitest): **283 tests across 28 files, green.**
- `npm run e2e` (Playwright, `retries: 0`): **2 passed**, `chromium` at 1280x800
  with a mouse and `ipad` (iPad Mini landscape, 1024x768, WebKit, touch). Run
  three times consecutively with no flakiness.
- `npm run build`: standalone output, ten routes plus the proxy.

## Tasks and commits

| Task | Commit | What |
|---|---|---|
| 1 | `122bf1f` | Scaffold, the gate, design tokens |
| 2 | `98f0697` | The 18 relationships, Piper's groups and definitions |
| 3 | `b219545` | Document types, arc ids, forest queries |
| 4 | `0eed119` + `e7758dd` | `validateDoc` and the derived status |
| 5 | `db29f66` | Split and rejoin, dissolve on resplit |
| 6 | `4c6f6d2` + `e6d5745` | Create, relabel, dissolve, circle |
| 7 | `41f6c2d` + `16ad6a8` | The stacked layout and Piper's Romans fixture |
| 8 | `c954502` + `7150094` | Password, session cookie, login limiter |
| 9 | `527f311` | ESV client and the verse-marker parser |
| 10 | `c0ebfb6` + `0bcd624` | The JSON file store |
| 11 | `be013e7` + `a6fae07` + `23768b2` | API routes and route protection |
| 12 | `c8d7c99` | Client store, 200-step undo history |
| 13 | `8b6f7f4` + `1e0821e` + `c0989e1` | API client and the autosave engine |
| 14 | `c27f006` | Login screen |
| 15 | `6077267` | Series list and the New arc sheet |
| 14+15 fix | `bdd2961` | Touch targets, series and sheet stylesheet, load-failure state, login a11y |
| 16 | `04fe1cd` + `89ecfb8` | Arc frame, save chip, ESV notice, the three error states |
| 17 | `2814822` + `a7a52e6` + `4618f3a` | Split screen and the arc workspace shell |
| 18 | `32c3943` | The inline SVG arc renderer |
| 19 | `a47f20f` + `57edece` | Relate screen and the palette of 18 |
| 20 | `828a220` + `825a15a` | Summarize screen, plus the consolidated stylesheet pass |
| 21 | `152a5bc` | The Playwright flow |
| 22 | `2b72160` | Deploy unit, Caddy vhost, workflow, `KICKOFF.md` |
| final review fix wave | `b804cd2` + `298e4c7` | Stale rev at the send boundary, plus eleven more |

## Deploy state

**The app is LIVE on the box and verified end to end.** Everything except DNS
is done.

- `arcing.service` installed and enabled, `active`, port **3006**, built ON THE
  BOX (node v22.23.2, linux) from `298e4c7` rather than cross-built on the Mac.
  Redeployed twice after the final fix waves and re-verified each time:
  `/login` 200, `/` 307 to login, `/api/arcs` 401 unauthenticated, data dir empty.
- `/srv/deploy/arcing/{current,data}` created, `deploy:deploy`. `.env` written
  `root:deploy` mode 640 with `APP_PASSWORD_HASH`, `SESSION_SECRET`,
  `ESV_API_KEY`, `DATA_DIR`. `APP_E2E_AUTH` is deliberately absent; it is
  dev-only and double gated on `NODE_ENV`.
- Caddy vhost `arcing.bushidoacquisitions.com` appended and reloaded,
  `caddy validate` clean. It carries one line the other vhosts do not,
  `header_up X-Forwarded-For {remote_host}`, as defence in depth behind the
  login limiter's last-hop read.
- Sudoers extended, not replaced:
  `/etc/sudoers.d/deploy-restart` now ends `, /usr/bin/systemctl restart arcing`,
  `visudo -c` clean. Backup taken at `/root/deploy-restart.bak.2026-09-06`.
- Nightly backup wired into the existing `/usr/local/bin/pg-backup.sh`
  (03:30, 14-day retention): a `tar czf` of `/srv/deploy/arcing/data`, its own
  `find` sweep line (the existing one matches only `*.sql.gz`), and
  `--include "arcing-data-*"` on the `gdrive-personal` copy. `bash -n` clean.
  Backup at `/root/pg-backup.sh.bak.2026-09-06`. **Verify the tarball appears
  after the first 03:30 run.**
- Live smoke test against `127.0.0.1:3006`, then cleaned up: login with the
  real password **200**, wrong password **401**, unauthenticated `/api/arcs`
  **401**, `POST /api/arcs {"reference":"John 11:35"}` **201** returning
  `canonical: "John 11:35"`, `source: "esv-api"`, `text: "Jesus wept."`,
  `verses: [{n:35,start:0}]`, with the JSON file written to disk. That single
  test arc was deleted, so the series starts empty.
- **DNS PENDING.** `arcing.bushidoacquisitions.com` has no A record yet, so the
  public URL does not resolve. The service itself is proven over loopback.

## Drew's remaining steps

1. **Add the Porkbun A record:** `arcing.bushidoacquisitions.com` to
   `155.138.231.13`. Porkbun is both registrar and DNS host for
   bushidoacquisitions.com. Caddy will issue the certificate automatically on
   the first request. Until then, verify with:
   `ssh -i ~/.ssh/vultr_box root@155.138.231.13 "curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3006/login"`
2. **First login** with the password from `~/.config/arcing-password`. It is
   already hashed into the box's env file; nothing further to install.
3. **Decide the app's real name.** `arcing` is the working name in the repo,
   the hostname, the systemd service and the deploy paths. `KICKOFF.md` step 1
   has the one-pass rename if you want a different one. The environment
   variable names (`APP_PASSWORD_HASH`, `APP_E2E_AUTH`, `SESSION_SECRET`,
   `ESV_API_KEY`, `DATA_DIR`) are literal and are NOT part of that rename.
4. Optional, for push-to-deploy: `KICKOFF.md` step 9 creates the deploy key and
   sets the two GitHub secrets `BOX_SSH_KEY` and `BOX_KNOWN_HOSTS`. Until then
   the workflow at `.github/workflows/deploy-box.yml` will not run, and deploys
   are the manual clone-build-rsync this session used.

## Decisions this build had to make

The plan and the spec are the authority. Where they were silent, or where a
review found something they had not anticipated, the build ruled. Every ruling
is here with what it costs if it is wrong.

1. **`isRooted` requires the sole top-level unit to be an ARC**, not a bare
   proposition. The plan's own code returned true for a single unarced
   proposition and so failed the plan's own test. The spec settles it: relate
   "until one arc spans the passage". Cost: a one-proposition passage can never
   be summarized, which is correct, since it has nothing to relate.
2. **`doc.arcs` is kept in creation order, inner arc before outer.**
   `ancestorsOfProp` derives ancestor order from the array rather than walking
   outward, so `createArc` must append and nothing may sort. Cost if broken: a
   split would mis-list the arcs it dissolves.
3. **Arc ids restart at `a1` only after a full dissolve.** The plan asked for
   ids that never come back; a persistent counter would add a second field
   beyond the spec's JSON, which already took `markedComplete` as its one
   documented addition. The only way to reissue `a1` is to dissolve every arc
   first, at which point nothing holds the old id. Cost: an id is unique among
   live arcs, not across all time.
4. **`memberCountFit(rel, n)` is exported from `relationships.ts`** and called
   by `canRelate`, `relabelArc` and `validateDoc`. The rule was written three
   times, twice verbatim, and all three ignored `maxMembers`. Cost: one more
   cross-module import inside core.
5. **The serif wrap risk was measured, not assumed.** `MAX_CHARS 58` was fitted
   against the mockup's sans stack while the spec binds passage text to a
   serif. Measured in headless Chromium at 17 px: Georgia is NARROWER than the
   sans for ordinary prose (widest real line 460.5 px against 467.0), so the
   budget is conservative and the widest line has 67 px of headroom in a 528 px
   column. `MAX_CHARS` stands and no geometry moved.
6. **The login limiter reads the LAST `X-Forwarded-For` hop**, not the first.
   Caddy appends rather than replaces, so a client-supplied first hop is
   attacker-controlled and the limiter could be sidestepped entirely, at one
   `scryptSync` per attempt. The Caddy vhost also pins the header. Cost: with a
   second proxy added in front later, the trustworthy hop moves; the comment at
   the site says so.
7. **`SaveResult` gained a sixth variant, `{kind:"error", message}`.** `putArc`
   used to throw into a `void run()` timer where nothing could catch it, so the
   save loop died with the chip stuck on Saving. On the client the autosave
   timer is the top of the stack, so the server-side throw-and-let-the-route-
   catch pattern does not transfer.
8. **`rev` is a server concurrency token and never travels through the undo
   history.** Without this, every undo after a save PUT a stale rev and raised
   a false conflict banner. `latestServerRev` lives outside the undo-tracked
   slice and undo and redo re-stamp only that field. Cost: an undo could
   overwrite a genuinely concurrent edit, which in a single-user tool is the
   user's own stale second tab, and Overwrite already exists for that.
9. **The workspace shell moved to `src/app/a/[id]/layout.tsx`.** The three tabs
   were sibling route leaves, so every tab click remounted the shell, cleared
   the undo history and dropped an in-flight edit. Cost: a route restructure
   late in the build, covered by the build and the Playwright flow.
10. **THE COLOUR RULING.** The spec's palette is closed and says "one reading,
    no substitutions". So: all text is ink; hierarchy comes from size, weight,
    spacing and position; exactly one derived neutral, `--rule`, for borders
    and separators only; no `color-mix(..., transparent)`, which is `rgba`
    renamed; an accent tint on a selected or active surface is legitimate; and
    **no text may fall below 4.5:1 against paper, including text dimmed by
    `opacity`.** Two rounds of drift (nine values, then nine more) were cleaned
    in one consolidated pass. Cost: a flatter interface than a designer would
    choose, recoverable by adding tokens deliberately rather than by drift.
11. **Neither conflict-banner button is coloured destructive.** Reload discards
    the edits on screen plus the whole undo history with nothing able to
    recover them; Overwrite discards a server revision the user cannot see,
    which in a single-user tool is nearly always their own stale tab. The
    unrecoverable loss sits on Reload, so colouring Overwrite red would mark
    the safe option as the dangerous one. Both stay neutral and the copy names
    both consequences.
12. **Where an arc's label target and its parent's circle target coincide, the
    arc label wins the tap.** They land on the same point whenever a member is
    itself an arc, because a circled member arc's circle sits exactly on that
    arc's symbol, which is Piper's own reading and is pinned to the mockup.
    `RelateView` interprets the callback rather than the pixel, and an arc
    member's circle is set from the PARENT's label sheet. Cost: one more
    affordance in the sheet than the spec drew.
13. **The palette's resting block reason was lifted out of the rows.** At rest
    all 18 rows are unfit for the same selection-level reason, so printing it
    18 times inverted the hierarchy of the one screen that exists to be
    scanned, and dimming them put the definitions at 3.86:1. Now the block
    prints once above the four groups, nothing is dimmed at rest, and only a
    row unfit on its own member count against a real selection is dimmed.
14. **Removing a summary level confirms when the level has content**, and
    removes on one tap when empty. This amends the plan's own test, which
    asserted an immediate removal. It is the rule `SplitView` already applies:
    confirm only when the action actually destroys something.
15. **The dialog backdrops were dropped, not repaired.** `.sheet::before` and
    `.modal::before` both tinted their own dialog instead of the page behind
    it, twice, for the same reason (a transformed ancestor becomes the
    containing block for a fixed-position pseudo-element, and a negative-z
    child paints above its ancestor's background). A backdrop was never in the
    spec; it was invented during a fix round. See the open items below.
16. **Task review and next-task implementation ran concurrently** where their
    file sets were disjoint, and three scoped re-reviews were folded into the
    final whole-branch review because of a context budget. Every other round
    got its own.

## Open items for Drew, none blocking

1. **Dialogs no longer block clicks behind them.** Dropping the two broken
   backdrops also dropped their incidental click-blocking, on all four dialogs
   rather than the two that were broken. There was never a click-outside-to-
   close handler, so nothing regressed functionally, but a real backdrop or a
   focus trap is the proper fix if it bothers you in use.
2. **Disabled controls now read as inert only by their `disabled` attribute**
   plus a flat border, since the opacity that used to dim them put text at
   1.93:1 and 2.49:1. That is the direct consequence of the contrast half of
   the colour ruling and is worth your eyes in real use.
3. **A circled proposition renders as an empty oval**, where Piper's paper
   prints "Pu" inside it. This follows from the spec's own `Geometry`, which
   gives one symbol per arc at the arc's midpoint rather than Piper's split
   lettering. A circled member ARC still lands on that arc's symbol, which is
   the correct reading. Flagged as a v2 question.
4. **The ESV storage term is named, not enforced.** Crossway's free tier allows
   500 verses stored; each arc keeps its own text, so at roughly 8 verses a
   Saturday it binds near 60 arcs. No code counts.
5. **Push-to-deploy is not wired** until the two GitHub secrets exist.

## Blocked items

None. Every task in the plan was completed and no task was abandoned. No
`BLOCKED` entry was recorded at any point in the build.

## What the final whole-branch review caught

Worth recording, because it is the class of defect this build's process existed
to find and it was found only at the end.

The **Critical** was a stale `rev` escaping past the send boundary. The ruling
that a revision number must never travel through the undo history had been
implemented at the undo and redo callsites but not at the point the document
actually goes on the wire, so an edit that landed while a save was in flight,
or any edit made after an undo, PUT the pre-save revision, got a 409, and the
"This arc changed somewhere else" banner offered Reload, which discards the
local edit and the whole undo history. Nothing in 276 tests could see it,
because the save mock returned the same document and so `rev` never advanced
anywhere in the suite. The fix moved the re-stamp INTO the autosave engine as a
required dependency applied at every site that assigns `pending`, so there is
exactly one authority for "the revision this client believes the server is at",
and the localStorage mirror is keyed off the same stamped object that goes on
the wire. A genuinely concurrent write from a second tab still produces a 409.

The four Important findings were: user-agent button chrome filling in where the
stylesheet declared a background but no colour, putting three frame controls at
about 1.97:1 against a binding 4.5:1 floor; a confirm dialog dismissed by an
ordinary autosave tick because it compared documents by reference; an
unreadable arc vanishing from the series list with no signal, in an app with no
delete affordance to explain an absence; and the series row printing the UTC
day while the arc id is deliberately dated America/New_York, which undid the
timezone decision for anything created after 20:00 ET.

One residual is recorded rather than fixed: in the sub-second window between a
mid-flight edit and the save response landing, the mirror is still keyed at the
pre-save revision, because the client cannot know the next revision before the
server states it. Closing that means keying the mirror on something other than
the revision, which changes the mirror's contract.
