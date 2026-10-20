import { expect, test, type Page } from "@playwright/test";
import { article, cleanUp, createText, openReader, wordAt, type Created } from "./reader-helpers";

let created: Created | null = null;

test.afterEach(async ({ page }) => {
  await cleanUp(page, created);
  created = null;
});

const focusedWord = (page: Page) => page.evaluate(() => document.activeElement?.getAttribute("data-i") ?? null);
const pageLabel = (page: Page) => page.getByText(/^Page \d+ of \d+$/).first();

async function open(page: Page) {
  created = await createText(page);
  await openReader(page, `/read/${created.id}`);
  await expect(wordAt(page, 0)).toBeVisible();
}

async function tabToText(page: Page) {
  await page.getByRole("button", { name: "Keyboard shortcuts" }).focus();
  for (let i = 0; i < 10 && (await focusedWord(page)) === null; i++) await page.keyboard.press("Tab");
}

test("Tab lands on the page's first word, once, and Tab again leaves the text", async ({ page }) => {
  await open(page);
  await tabToText(page);
  expect(await focusedWord(page)).toBe("0");
  await expect(wordAt(page, 0)).toBeFocused();
  const ring = await wordAt(page, 0).evaluate((el) => getComputedStyle(el).outlineStyle);
  expect(ring).not.toBe("none");
  await page.keyboard.press("Tab");
  expect(await focusedWord(page)).toBeNull();
  expect(await article(page).locator("[tabindex='0']").count()).toBe(1);
});

test("Enter opens the word's card, Escape closes it keeping focus, and Space opens it again", async ({ page }) => {
  await open(page);
  await tabToText(page);
  await page.keyboard.press("Enter");
  const card = page.getByRole("dialog", { name: created!.word(0) });
  await expect(card).toBeVisible();
  await expect(page.getByTestId("meanings")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(card).toHaveCount(0);
  await expect(wordAt(page, 0)).toBeFocused();
  await page.keyboard.press(" ");
  await expect(card).toBeVisible();
});

test("arrows move focus between words without turning the page, and back", async ({ page }) => {
  await open(page);
  await tabToText(page);
  const before = await pageLabel(page).textContent();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(wordAt(page, 2)).toBeFocused();
  await expect(pageLabel(page)).toHaveText(before!);
  await page.keyboard.press("ArrowLeft");
  await expect(wordAt(page, 1)).toBeFocused();
  await expect(page.getByTestId("meanings")).toHaveCount(0);
});

test("with a card open, an arrow opens the next word's card and focus follows", async ({ page }) => {
  await open(page);
  await tabToText(page);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: created!.word(0) })).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("dialog", { name: created!.word(1) })).toBeVisible();
  await expect(wordAt(page, 1)).toBeFocused();
});

test("shift-tab back into the text returns to the word last focused", async ({ page }) => {
  await open(page);
  await tabToText(page);
  for (let i = 0; i < 4; i++) await page.keyboard.press("ArrowRight");
  await expect(wordAt(page, 4)).toBeFocused();
  await page.keyboard.press("Tab");
  expect(await focusedWord(page)).toBeNull();
  await page.keyboard.press("Shift+Tab");
  await expect(wordAt(page, 4)).toBeFocused();
});

test("with no word focused, an arrow still turns the page", async ({ page }) => {
  await open(page);
  const before = await pageLabel(page).textContent();
  await page.locator("body").focus();
  await page.keyboard.press("ArrowRight");
  await expect(pageLabel(page)).not.toHaveText(before!);
});
