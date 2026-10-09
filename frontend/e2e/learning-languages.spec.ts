import { expect, test, type Locator, type Page } from "@playwright/test";

const SIX = ["English", "Spanish", "French", "German", "Italian", "Portuguese"];
const SIX_NATIVE = ["English", "Español", "Français", "Deutsch", "Italiano", "Português"];

const optionNames = (select: Locator) =>
  select.locator("option").evaluateAll((os) => os.map((o) => o.textContent ?? "").filter((t) => t !== "—"));

async function expectSix(page: Page, path: string, select: (page: Page) => Locator) {
  await page.goto(path);
  await expect(select(page)).toBeVisible();
  expect(await optionNames(select(page))).toEqual(SIX);
}

test("the top-bar switcher offers the six languages", async ({ page }) => {
  await page.goto("/library");
  await page.getByRole("banner").getByRole("button", { name: /Change language/ }).click();
  const items = page.getByRole("menu", { name: "Language" }).getByRole("menuitemradio");
  await expect(items).toHaveCount(6);
  for (const [i, name] of SIX_NATIVE.entries()) await expect(items.nth(i)).toContainText(name);
});

test("onboarding offers the six languages", async ({ page }) => {
  await page.goto("/onboarding");
  await expect(page.getByRole("heading", { name: "What are you learning?" })).toBeVisible();
  const choices = page.getByRole("main").getByRole("button", { pressed: false });
  await expect(choices).toHaveCount(6);
  for (const name of SIX_NATIVE) await expect(page.getByRole("button", { name: new RegExp(name) })).toBeVisible();
  for (const name of ["日本語", "中文", "한국어"]) await expect(page.getByRole("button", { name: new RegExp(name) })).toHaveCount(0);
});

test("the import form offers the six languages", async ({ page }) => {
  await expectSix(page, "/import", (p) => p.getByRole("main").getByLabel("Language"));
});

test("Settings offers the six as a learning language, and all native languages", async ({ page }) => {
  await expectSix(page, "/settings", (p) => p.getByLabel("Main language you're learning"));
  const native = await page.locator("select").nth(1).locator("option").allTextContents();
  expect(native).toEqual(expect.arrayContaining(["日本語", "中文", "한국어"]));
});

test("a new class offers the six languages", async ({ page }) => {
  await expectSix(page, "/classes", (p) => p.getByRole("main").getByLabel("Language"));
});

test("a new playlist offers the six languages", async ({ page }) => {
  await expectSix(page, "/playlists", (p) => p.getByRole("main").getByLabel("Language"));
});
