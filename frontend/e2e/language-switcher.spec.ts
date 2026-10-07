import { expect, test, type Locator, type Page } from "@playwright/test";

// docs/acceptance/language-switcher.feature: the top bar's language switcher is a plain control like the counters
// beside it (no box), with their soft pill only on hover or while its menu is open.

const banner = (page: Page) => page.getByRole("banner");
const switcher = (page: Page) => banner(page).getByRole("button", { name: /Change language/ });
const known = (page: Page) => banner(page).getByTestId("known-words");
const style = (el: Locator) =>
  el.evaluate((e) => {
    const s = getComputedStyle(e);
    return { border: s.borderTopWidth, background: s.backgroundColor };
  });
const TRANSPARENT = "rgba(0, 0, 0, 0)";

/** Answers language switches in the browser, so the shared test user's language is never changed. */
async function answerSwitches(page: Page) {
  const me = await (await page.request.get("/api/me")).json();
  await page.route("**/api/me", (route) => {
    if (route.request().method() !== "PATCH") return route.continue();
    const { targetLanguage } = route.request().postDataJSON();
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ...me, targetLanguage }) });
  });
}

async function pick(page: Page, native: string) {
  await switcher(page).click();
  await page.getByRole("menu", { name: "Language" }).getByRole("menuitemradio", { name: new RegExp(native) }).click();
}

test.describe("on a desktop", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/library");
    await page.mouse.move(0, 400);
  });

  test("at rest the switcher has no box, and lines up with the counters", async ({ page }) => {
    await expect(switcher(page)).toBeVisible();
    expect(await style(switcher(page))).toEqual({ border: "0px", background: TRANSPARENT });
    const button = (await switcher(page).boundingBox())!;
    const counter = (await known(page).boundingBox())!;
    expect(Math.abs(button.height - counter.height)).toBeLessThanOrEqual(1);
    expect(Math.abs(button.y + button.height / 2 - (counter.y + counter.height / 2))).toBeLessThanOrEqual(1);
  });

  test("hovering shows the same soft pill as a counter", async ({ page }) => {
    await known(page).hover();
    await expect.poll(async () => (await style(known(page))).background).not.toBe(TRANSPARENT);
    const pill = (await style(known(page))).background;
    await switcher(page).hover();
    await expect.poll(async () => (await style(switcher(page))).background).toBe(pill);
  });

  test("the pill stays while the menu is open and goes when it closes", async ({ page }) => {
    await known(page).hover();
    await expect.poll(async () => (await style(known(page))).background).not.toBe(TRANSPARENT);
    const pill = (await style(known(page))).background;
    await switcher(page).click();
    await expect(page.getByRole("menu", { name: "Language" })).toBeVisible();
    await page.mouse.move(0, 400);
    await expect.poll(async () => (await style(switcher(page))).background).toBe(pill);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu", { name: "Language" })).toHaveCount(0);
    await expect.poll(async () => (await style(switcher(page))).background).toBe(TRANSPARENT);
  });

  test("it shows the language being learned: badge, own name and a chevron", async ({ page }) => {
    await answerSwitches(page);
    await pick(page, "Deutsch");
    await expect(switcher(page)).toHaveText(/^DE\s*Deutsch$/, { useInnerText: true });
    await expect(switcher(page).locator("svg")).toBeVisible();
    await pick(page, "Français");
    await expect(switcher(page)).toHaveText(/^FR\s*Français$/, { useInnerText: true });
    await expect(switcher(page)).toHaveAccessibleName("Studying French. Change language");
  });

  test("with no language chosen it asks for one", async ({ page }) => {
    // The shared test account never has a target language (see CLAUDE.md).
    await expect(switcher(page)).toHaveText("?Choose language");
  });
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 800 } });

  test("only the badge and chevron show, still without a box", async ({ page }) => {
    await page.goto("/library");
    await answerSwitches(page);
    await pick(page, "Deutsch");
    await expect(switcher(page).getByText("Deutsch")).toBeHidden();
    // The badge's text is lower case, shown in capitals by CSS.
    await expect(switcher(page).getByText("de", { exact: true })).toBeVisible();
    await expect(switcher(page).locator("svg")).toBeVisible();
    await page.mouse.move(0, 700);
    expect((await style(switcher(page))).border).toBe("0px");
  });
});
