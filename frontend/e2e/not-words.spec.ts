import { expect, test, type Page } from "@playwright/test";
import { cleanUp, createTextWith, openReader, popupClose, wordAt, type Created } from "./reader-helpers";

let created: Created | null = null;

test.afterEach(async ({ page }) => {
  await cleanUp(page, created);
  created = null;
});

const JUNK_AT = [0, 4];

async function textWithANotWord(page: Page): Promise<{ created: Created; junk: string }> {
  let junk = "";
  const c = await createTextWith(page, (w) => {
    junk = `${w(1).slice(0, -1)}nonmot`;
    return `${junk} ${w(1)} ${w(2)}. ${w(3)} ${junk} ${w(4)}.`;
  });
  return { created: c, junk };
}

async function savedTerms(page: Page, c: Created): Promise<string[]> {
  const found = await (await page.request.get(`/api/vocabulary?language=${c.language}&q=${c.prefix}&size=200`)).json();
  return ((found.items ?? []) as { term: string }[]).map((e) => e.term);
}

test("a word that isn't a word shows like an ignored word and isn't counted as new", async ({ page }) => {
  const t = await textWithANotWord(page);
  created = t.created;
  await openReader(page, `/read/${created.id}`);
  for (const n of JUNK_AT) await expect(wordAt(page, n)).toHaveClass(/w-ignored/);
  await expect(wordAt(page, 1)).toHaveClass(/w-new/);
  await expect(page.getByText("4 new · 0 learning")).toBeVisible();
});

test("finishing the lesson marks the other words known but not the not-word", async ({ page }) => {
  const t = await textWithANotWord(page);
  created = t.created;
  await openReader(page, `/read/${created.id}`);
  await expect(page.locator("[data-finish=prompt]").getByText("The 4 words you didn't click will be marked as known.")).toBeVisible();
  const completed = page.waitForResponse((r) => r.url().endsWith(`/api/texts/${created!.id}/complete`));
  await page.getByRole("button", { name: "Finish lesson" }).click();
  expect((await completed).ok()).toBe(true);
  await expect(page.getByText("4 new words marked as known.")).toBeVisible();
  for (const n of JUNK_AT) await expect(wordAt(page, n)).toHaveClass(/w-ignored/);
  expect(await savedTerms(page, created)).not.toContain(t.junk);
});

test("clicking a not-word opens the popup, and Known turns it into a word", async ({ page }) => {
  const t = await textWithANotWord(page);
  created = t.created;
  await openReader(page, `/read/${created.id}`);
  await wordAt(page, 0).click();
  const saved = page.waitForResponse((r) => r.url().endsWith("/api/vocabulary") && r.request().method() === "POST");
  await page.getByRole("button", { name: "Known", exact: true }).click();
  expect((await saved).ok()).toBe(true);
  await popupClose(page).click();
  for (const n of JUNK_AT) await expect(wordAt(page, n)).toHaveClass(/w-known/);
  expect(await savedTerms(page, created)).toContain(t.junk);
});
