import { expect, test, type Page, type Route } from "@playwright/test";
import type { WordImportJob } from "../lib/word-import";

const job = (over: Partial<WordImportJob>): WordImportJob => ({
  id: 9_000_101, source: "lingq", language: "fr", state: "running", found: 0, added: 0, updated: 0, unchanged: 0,
  overLimit: 0, error: null, createdAt: new Date().toISOString(), finishedAt: null, ...over,
});

const panel = (page: Page) => page.getByRole("region", { name: "Import words" });
const row = (page: Page) => panel(page).getByTestId("word-import").first();
const spinner = '[data-testid="spinner"]';

async function openImport(page: Page) {
  await page.goto("/vocabulary");
  await page.getByRole("button", { name: "Import words" }).click();
}

async function stubList(page: Page, lists: WordImportJob[][]) {
  await page.route("**/api/word-imports", (route: Route) =>
    route.request().method() === "GET" ? route.fulfill({ json: lists.length > 1 ? lists.shift() : lists[0] }) : route.fallback());
}

test("clicking Import shows Starting… with a spinner at once, and can't start a second import", async ({ page }) => {
  let posts = 0;
  let release = () => {};
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route("**/api/word-imports/lingq", async (route) => {
    posts++;
    await held;
    await route.fulfill({ status: 400, json: { code: "bad_request", message: "stop here" } });
  });
  await stubList(page, [[]]);
  await openImport(page);
  await panel(page).getByLabel("LingQ API key").fill("abc123");
  await panel(page).getByRole("button", { name: "Import from LingQ" }).click();
  const starting = panel(page).getByRole("button", { name: "Starting…" });
  await expect(starting).toBeDisabled();
  await expect(starting.locator(spinner)).toBeVisible();
  await panel(page).getByLabel("LingQ API key").press("Enter");
  release();
  await expect(panel(page)).toContainText("stop here");
  expect(posts).toBe(1);
});

test("a rejected start puts the button back and shows the error", async ({ page }) => {
  await page.route("**/api/word-imports/lingq", (route) =>
    route.fulfill({ status: 400, json: { code: "bad_request", message: "That doesn't look like a LingQ API key." } }));
  await stubList(page, [[]]);
  await openImport(page);
  await panel(page).getByLabel("LingQ API key").fill("bad key");
  await panel(page).getByRole("button", { name: "Import from LingQ" }).click();
  await expect(panel(page)).toContainText("That doesn't look like a LingQ API key.");
  const button = panel(page).getByRole("button", { name: "Import from LingQ" });
  await expect(button).toBeEnabled();
  await expect(panel(page).locator(spinner)).toHaveCount(0);
});

test("a running import spins on its row and the button until it is done, then the word list refreshes", async ({ page }) => {
  await page.route("**/api/word-imports/lingq", (route) => route.fulfill({ status: 202, json: job({ state: "queued" }) }));
  const stages = [[], [job({})], [job({ found: 120, added: 120 })], [job({ state: "done", found: 450, added: 450 })]];
  let stage = 0;
  await page.route("**/api/word-imports", (route) => route.fulfill({ json: stages[stage] }));
  await openImport(page);
  await panel(page).getByLabel("Language").selectOption("fr");
  await expect(panel(page).getByRole("button", { name: "Import from LingQ" })).toBeEnabled();
  stage = 1;
  await panel(page).getByLabel("LingQ API key").fill("abc123");
  await panel(page).getByRole("button", { name: "Import from LingQ" }).click();
  await expect(row(page)).toContainText("LingQ · French · Importing…");
  await expect(row(page).locator(spinner)).toBeVisible();
  await expect(row(page)).toContainText("Fetching your words from LingQ…");
  const button = panel(page).getByRole("button", { name: "Importing…" });
  await expect(button).toBeDisabled();
  await expect(button.locator(spinner)).toBeVisible();
  await expect(panel(page)).toContainText("you can leave this page, it keeps going");
  stage = 2;
  await expect(row(page)).toContainText("120 found · 120 added", { timeout: 10_000 });
  const refreshed = page.waitForRequest((r) => r.method() === "GET" && /\/api\/vocabulary\?/.test(r.url()), { timeout: 10_000 });
  stage = 3;
  await expect(row(page)).toContainText("LingQ · French · Done", { timeout: 10_000 });
  await refreshed;
  await expect(row(page)).toContainText("450 found · 450 added");
  await expect(panel(page).locator(spinner)).toHaveCount(0);
  await expect(panel(page).getByRole("button", { name: "Import from LingQ" })).toBeEnabled();
});

test("a failed import stops spinning, says why and frees the button", async ({ page }) => {
  const reason = "LingQ didn't accept this API key. Copy it again from lingq.com/accounts/apikey.";
  let failed = false;
  await page.route("**/api/word-imports", (route) =>
    route.fulfill({ json: [failed ? job({ state: "failed", error: reason }) : job({})] }));
  await openImport(page);
  await panel(page).getByLabel("Language").selectOption("fr");
  await expect(row(page).locator(spinner)).toBeVisible();
  failed = true;
  await expect(row(page)).toContainText("LingQ · French · Failed", { timeout: 10_000 });
  await expect(row(page)).toContainText(reason);
  await expect(panel(page).locator(spinner)).toHaveCount(0);
  await expect(panel(page).getByRole("button", { name: "Import from LingQ" })).toBeEnabled();
});

test("coming back mid-import shows the spinner even with the form closed", async ({ page }) => {
  await stubList(page, [[job({ found: 40, added: 40 })]]);
  await page.goto("/vocabulary");
  await expect(panel(page).getByLabel("LingQ API key")).toHaveCount(0);
  await expect(row(page).locator(spinner)).toBeVisible();
  await expect(row(page)).toContainText("40 found · 40 added");
});

test("screen readers hear Importing once; counts aren't announced on every refresh", async ({ page }) => {
  await stubList(page, [[job({ found: 10, added: 10 })], [job({ found: 20, added: 20 })]]);
  await page.goto("/vocabulary");
  await expect(panel(page).getByRole("status")).toHaveText("Importing");
  await expect(row(page)).toContainText("20 found", { timeout: 10_000 });
  await expect(panel(page).getByRole("status")).toHaveText("Importing");
  await expect(panel(page).locator('[aria-live]:not([role="status"])')).toHaveCount(0);
  await expect(row(page).locator(spinner)).toHaveAttribute("aria-hidden", "true");
});

test("the indicator spins normally, and is a still dot with reduced motion", async ({ page }) => {
  await stubList(page, [[job({})]]);
  const look = async () => row(page).locator(spinner).evaluate((el) => {
    const style = getComputedStyle(el);
    return { animation: style.animationName, filled: style.backgroundColor !== "rgba(0, 0, 0, 0)" };
  });
  await page.goto("/vocabulary");
  await expect(row(page).locator(spinner)).toBeVisible();
  expect(await look()).toEqual({ animation: "spin", filled: false });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect.poll(look).toEqual({ animation: "none", filled: true });
});
