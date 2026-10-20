import { expect, test } from "@playwright/test";
import { cleanUp, createText, openReader, wordAt, type Created } from "./reader-helpers";

let created: Created | null = null;

test.afterEach(async ({ page }) => {
  await cleanUp(page, created);
  created = null;
});

const selected = (page: import("@playwright/test").Page) => page.evaluate(() => window.getSelection()?.toString() ?? "");

test("shift-click after closing a word leaves no browser selection", async ({ page }) => {
  created = await createText(page, 300);
  await openReader(page, `/read/${created.id}`);
  await wordAt(page, 2).click();
  await expect(page.getByTestId("meanings")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.mouse.click(5, 300);
  await wordAt(page, 8).click();
  await wordAt(page, 11).click({ modifiers: ["Shift"] });
  await expect(page.getByText("Phrase", { exact: true })).toBeVisible();
  expect(await selected(page)).toBe("");
});

test("shift-click right after a click leaves no browser selection", async ({ page }) => {
  created = await createText(page, 300);
  await openReader(page, `/read/${created.id}`);
  await wordAt(page, 4).click();
  await wordAt(page, 7).click({ modifiers: ["Shift"] });
  await expect(page.getByText("Phrase", { exact: true })).toBeVisible();
  expect(await selected(page)).toBe("");
});
