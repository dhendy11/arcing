# Bible arcing tool: one-page spec

Drafted 2026-09-05 in the 11:00 block (Suke task 5186b589) from Drew's rulings that morning. This page
decides whether the tool gets built. Sources: `references/personal/bible-arcing.md` (the practice),
`references/personal/bible-arcing-primer.md` (Piper's booklet, page-cited), and
`projects/daily-driver/handoffs/2026-09-05/biblearc-brief.md` (what Biblearc does today). Piper's list of 18
relationships, the circling rule and the levels method were re-verified 2026-09-05 against the booklet itself,
https://cdn.desiringgod.org/pdf/booklets/BTBX.pdf (ch. 3-4, pp. 12-20; p. 22; pp. 23-24).

## Rulings, 2026-09-05

- For Drew only, at this point. Not a product.
- Standalone repo. Not inside the EA repo, not inside bushido-web.
- No subscription. Drew: "i don't want to be paying $100/year for this." Biblearc arcing is paid-only,
  $9.99/mo; the annual is either $89.99 or 20% off, the two sources disagree.
- Added 11:35: Drew used Biblearc when arcing was free and liked it, so its arcing screen is the reference
  for feel. ESV only to start. Mouse-driven. Must work on the iPad (Safari, touch). Public GitHub repo,
  open source. Planning gets done now so the build can run by subagents unattended.

## What the practice needs (Drew's words)

"split the sections up visually, see the choices of relationships and be able to come to a summary after
arcing." Three verbs. Those are the three screens.

## What it does that Biblearc does not

- **Shows the choices.** Biblearc hides the 18 relationships behind a handle click. Here, all 18 sit
  on screen in Piper's three groups with their one-line definitions, so choosing a label is comparing
  candidates, not recalling a name. Ground vs Inference gets Piper's own warning next to it (booklet p. 34).
- **Ends in a summary.** Once one arc spans the passage, a summary pane opens: the main point in ONE
  sentence, the argument written as levels from bottom to top with the connector between each (Piper
  p. 24), and one line on why it matters this week. Biblearc stops at the diagram.
- **Keeps a series.** Every arc is saved by date and passage, so the Saturday practice reads as a
  run (Ephesians as the spine) and feeds the memory work. Biblearc projects are not a dated series.
- **Owns the data.** Plain files in the repo, self-hosted on the box. Nothing a vendor can switch off.
- **Stays out of the way.** No AI drawing arcs, splitting propositions, or suggesting labels. The
  tool records what Drew does; questions and reconciliation stay in the Claude session afterward.

## The three screens

1. **Split.** Paste the passage (literal translation, Piper names the NASB). Click or keyboard-split
   into numbered propositions, one per line; rejoin with one key. Relative clauses stay inside their
   proposition; participles and infinitives split out when they assert something (primer, p. 27-28).
2. **Relate.** Select two neighbours or two groups, pick a relationship from the visible 18, and the
   arc draws. Build bottom-up to one arc. Circle the primary member for Ac-Pur, Ac-Res, Sit-R (p. 22).
   Pencil rule: anything can be undone or relabelled; the tool never locks a choice.
3. **Summarize.** Main point sentence, argument levels, why-it-matters line. Save. The passage and
   main-point sentence append to `logs/journal.md` in the EA repo under the Saturday date.

## Not in v1

Greek or Hebrew tags, bracketing, phrasing, sharing, multi-user accounts, phone layout (iPad is in),
Biblearc import, the four optional relationships (Both-And, General-Specific, Fact-Interpretation, Anticipation-Fulfillment).

## Build gate

CHANGED 11:35 by Drew: "if we get most of the planning done now it seems like it is a simple enough app
to be built by subagents unattended." The gate is now a reviewed design spec plus an implementation plan,
not three paper arcs. The paper practice continues alongside and feeds changes into the backlog.

## Open questions for the build session

- Passage text comes from the ESV API (needs a license key, free for non-commercial use per its terms,
  verify the daily verse limit and the copyright line before relying on it). Paste-in stays as the fallback.
- Does the journal append happen from the tool, or does an EA session read the series and log it?
- Ruled 11:35: mouse, not keyboard-first.
- Ruled 11:55: LAYOUT A, paper style vertical: propositions stacked top to bottom, arcs to the right, larger
  arcs nesting further out, symbols inside the arcs (mockup A in mockups/arcing-layouts.html).
