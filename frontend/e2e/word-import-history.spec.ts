import { expect, test, type Page, type Route } from "@playwright/test";
import type { WordImportJob } from "../lib/word-import";

// Which import history the Words page shows: docs/acceptance/word-import.feature, "What the Words page shows". The
// import list is stubbed in the browser, so nothing here reaches lingq.com or saves words.

const job = (over: Partial<WordImportJob>): WordImportJob => ({
  id: 9_000_201, source: "lingq", language: "fr", state: "done", found: 10, added: 10, updated: 0, unchanged: 0,
  overLimit: 0, error: null, createdAt: new Date().toISOString(), finishedAt: new Date().toISOString(), ...over,
});

const panel = (page: Page) => page.getByRole("region", { name: "Import words" });
const rows = (page: Page) => panel(page).getByTestId("word-import");

async function stubList(page: Page, list: () => WordImportJob[]) {
  await page.route("**/api/word-imports", (route: Route) =>
    route.request().method() === "GET" ? route.fulfill({ json: list() }) : route.fallback());
}

async function openImport(page: Page) {
  await page.goto("/vocabulary");
  await page.getByRole("button", { name: "Import words" }).click();
}

test("the history follows the form's source and language", async ({ page }) => {
  await stubList(page, () => [
    job({ id: 3, source: "readlang", found: 3 }),
    job({ id: 2, language: "de", found: 2 }),
    job({ id: 1, found: 1 }),
  ]);
  await openImport(page);
  const language = panel(page).getByLabel("Language");
  await language.selectOption("fr");
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page)).toContainText("LingQ · French · Done");
  await language.selectOption("de");
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page)).toContainText("LingQ · German · Done");
  // Japanese, Chinese and Korean are paused for learning: not offered.
  expect(await language.locator("option").evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value)))
    .not.toEqual(expect.arrayContaining(["ja"]));
  // Nothing imported yet for this choice: no rows at all.
  await language.selectOption("it");
  await expect(rows(page)).toHaveCount(0);
  await language.selectOption("");
  await expect(rows(page)).toHaveCount(0);
  // Switching source with French picked.
  await language.selectOption("fr");
  await panel(page).getByRole("button", { name: "Readlang" }).click();
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page)).toContainText("Readlang · French · Done");
});

test("a running import always shows; with the form closed and nothing running there is no history", async ({ page }) => {
  let running = true;
  await stubList(page, () => [
    ...(running ? [job({ id: 2, state: "running", finishedAt: null })] : []),
    job({ id: 1, language: "de" }),
  ]);
  await openImport(page);
  await panel(page).getByLabel("Language").selectOption("de");
  await expect(rows(page)).toHaveCount(2);
  await expect(rows(page).first()).toContainText("LingQ · French · Importing…");
  await expect(rows(page).nth(1)).toContainText("LingQ · German · Done");
  await page.getByRole("button", { name: "Import words" }).click();
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page)).toContainText("LingQ · French · Importing…");
  running = false;
  await page.reload();
  await expect(page.getByRole("button", { name: "Import words" })).toBeVisible();
  await expect(rows(page)).toHaveCount(0);
});

test("when a new import succeeds, the previous row for that choice disappears without a reload", async ({ page }) => {
  const old = job({ id: 1, found: 5 });
  let stage: WordImportJob[] = [old];
  await stubList(page, () => stage);
  await page.route("**/api/word-imports/lingq", (route) => {
    stage = [job({ id: 2, state: "running", found: 0, finishedAt: null }), old];
    return route.fulfill({ status: 202, json: stage[0] });
  });
  await openImport(page);
  await panel(page).getByLabel("Language").selectOption("fr");
  await expect(rows(page)).toHaveCount(1);
  await panel(page).getByLabel("LingQ API key").fill("abc123");
  await panel(page).getByRole("button", { name: "Import from LingQ" }).click();
  await expect(rows(page)).toHaveCount(2);
  await expect(rows(page).first()).toContainText("Importing…");
  await expect(rows(page).nth(1)).toContainText("5 found");
  stage = [job({ id: 2, found: 450, added: 450 })];
  await expect(rows(page)).toHaveCount(1, { timeout: 10_000 });
  await expect(rows(page)).toContainText("LingQ · French · Done");
  await expect(rows(page)).toContainText("450 found · 450 added");
});
