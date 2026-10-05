import { expect, test, type Page } from "@playwright/test";
import { cleanUp, createText, openReader, type Created } from "./reader-helpers";

// Chrome offers (or auto-runs) page translation when a page reads as another language, and a lesson page is mostly
// that language. Translation rewrites text React rendered (wrapping it in <font> tags), which breaks hydration and
// crashes the page on the next update ("removeChild ... not a child of this node"). Every page opts out.

let created: Created | null = null;

test.afterEach(async ({ page }) => {
  await cleanUp(page, created);
  created = null;
});

async function expectNoTranslate(page: Page) {
  await expect(page.locator("html")).toHaveAttribute("translate", "no");
  await expect(page.locator('head meta[name="google"]')).toHaveAttribute("content", "notranslate");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
}

test("a lesson in the reader tells the browser not to translate it, keeping its languages declared", async ({ page }) => {
  created = await createText(page, 100);
  await openReader(page, `/read/${created.id}`);
  await expectNoTranslate(page);
  await expect(page.locator("article")).toHaveAttribute("lang", created.language);
});

for (const path of ["/library", "/explore", "/words", "/review", "/progress", "/settings"]) {
  test(`${path} tells the browser not to translate it`, async ({ page }) => {
    await page.goto(path);
    await expectNoTranslate(page);
  });
}
