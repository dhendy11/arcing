# arcing

A single-user web tool for the Saturday Bible arcing practice: split a passage into propositions, relate them with Piper's 18 relationships until one arc spans the passage, and write the summary. It records what Drew does; it never draws, splits, labels or suggests. Scripture text is fetched from the ESV API and displayed under Crossway's standard-use permission; the ESV copyright notice is shown in the app.

## Commands

- `npm run dev` - run the app locally.
- `npm run gate` - `tsc --noEmit && eslint . && vitest run`. The required check before any commit.
- `npm run e2e` - Playwright, run separately from the gate.
- `npm run hash-password` - generate the scrypt hash for `APP_PASSWORD_HASH`.

## Docs

The design spec and build plan live in `docs/superpowers/specs/` and `docs/superpowers/plans/`.

## Deploy

Deployment files and the box kickoff steps live in `deploy/` and `KICKOFF.md` (added later in the build).
