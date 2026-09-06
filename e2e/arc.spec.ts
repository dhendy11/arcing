// The one end to end flow (design spec, Testing). Real browser, retries 0,
// no jsdom. It builds John Piper's own arc of Romans 12:1-2 (Biblical
// Exegesis pp. 21-23) exactly as he prints it: Negative-Positive over 2a and
// 2b, Action-Purpose over that pair and 2c with 2c circled, Action-Purpose
// over 12:1 and that whole unit with 12:1 circled.
//
// Never put a passage Drew arcs himself in a fixture. Ephesians is his own
// weekly series.
//
// Two regression guards live inside this flow rather than as separate tests
// (Task 17 review): both defects were in the wiring between the store, the
// autosave engine and the frame, which no component test touches, because
// the autosave suite mocks onSaved/onError/onConflict and the frame suite
// passes onUndo/onRedo in as mock props. A happy path would not exercise
// either by accident, so both are forced explicitly at the point in the
// flow where they apply.
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

  // ADDITION 2 regression guard: switching Split/Relate/Summarize tabs used
  // to remount the workspace, which cleared undo history and dropped
  // whatever edit was still inside the debounce window. Switch away and
  // back with the last split still unsaved (no wait for the save chip
  // first) and confirm both the content and the undo history survive.
  await page.getByRole("tab", { name: "Relate" }).click();
  await page.getByRole("tab", { name: "Split" }).click();
  await expect(page.locator("[data-proposition]")).toHaveCount(4);
  await expect(page.getByRole("button", { name: "Undo" })).toBeEnabled();

  await expect(page.getByTestId("save-chip")).toHaveText("Saved", SAVED);

  // ADDITION 1 regression guard: undo used to need two presses after a
  // completed save round trip, and the resend used to raise a false
  // conflict against the client's own save. One more edit, wait for the
  // save chip to actually reach Saved, then a SINGLE Undo press.
  const extraSplitAt = PIPER_ROMANS_TEXT.indexOf("your bodies");
  await page.locator(`[data-word-start="${extraSplitAt}"]`).click();
  await expect(page.locator("[data-proposition]")).toHaveCount(5);
  await expect(page.getByTestId("save-chip")).toHaveText("Saved", SAVED);

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.locator("[data-proposition]")).toHaveCount(4);
  await expect(page.locator(".banner-conflict")).toHaveCount(0);
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
  // exact: true, because "Move level 1 up" and "Remove level 1" are also
  // accessible names containing the substring "Level 1".
  await page.getByLabel("Level 1", { exact: true }).fill("God's mercies are the ground of the appeal.");
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
