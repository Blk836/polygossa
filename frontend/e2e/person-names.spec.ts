import { expect, test, type Page } from "@playwright/test";
import { cleanUp, createTextWith, openReader, popupClose, wordAt, type Created } from "./reader-helpers";

let created: Created | null = null;

test.afterEach(async ({ page }) => {
  await cleanUp(page, created);
  created = null;
});

const NAME_AT = [0, 4];

async function textWithAName(page: Page): Promise<{ created: Created; name: string }> {
  let name = "";
  const c = await createTextWith(page, (w) => {
    const prefix = w(1).slice(0, -1);
    name = `${prefix[0].toUpperCase()}${prefix.slice(1)}persona`;
    return `${name} ${w(1)} ${w(2)}. ${w(3)} ${name} ${w(4)}.`;
  });
  return { created: c, name };
}

const statusButton = (page: Page, name: string) => page.getByRole("button", { name, exact: true });

async function savedTerms(page: Page, c: Created): Promise<string[]> {
  const found = await (await page.request.get(`/api/vocabulary?language=${c.language}&q=${c.prefix}&size=200`)).json();
  return ((found.items ?? []) as { term: string }[]).map((e) => e.term);
}

test("a person's name shows like an ignored word and isn't counted as new", async ({ page }) => {
  const t = await textWithAName(page);
  created = t.created;
  await openReader(page, `/read/${created.id}`);
  for (const n of NAME_AT) await expect(wordAt(page, n)).toHaveClass(/w-ignored/);
  await expect(wordAt(page, 1)).toHaveClass(/w-new/);
  await expect(page.getByText("4 new · 0 learning")).toBeVisible();
});

test("clicking a name opens the popup without saving it; Learning turns it into a word", async ({ page }) => {
  const t = await textWithAName(page);
  created = t.created;
  await openReader(page, `/read/${created.id}`);
  const writes: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/api/vocabulary") && r.method() !== "GET") writes.push(r.url());
  });

  await wordAt(page, 0).click();
  await expect(statusButton(page, "Learning")).toBeVisible();
  await popupClose(page).click();
  await expect(wordAt(page, 0)).toHaveClass(/w-ignored/);
  expect(writes).toEqual([]);
  expect(await savedTerms(page, created)).not.toContain(t.name.toLowerCase());

  const saved = page.waitForResponse((r) => r.url().endsWith("/api/vocabulary") && r.request().method() === "POST");
  await wordAt(page, 0).click();
  await statusButton(page, "Learning").click();
  expect((await saved).ok()).toBe(true);
  await popupClose(page).click();
  for (const n of NAME_AT) await expect(wordAt(page, n)).toHaveClass(/w-learning/);
  await expect(page.getByText("4 new · 1 learning")).toBeVisible();
});

test("finishing the lesson marks the other words known but not the name", async ({ page }) => {
  const t = await textWithAName(page);
  created = t.created;
  await openReader(page, `/read/${created.id}`);
  await expect(page.getByText("The 4 words you didn't click will be marked as known.")).toBeVisible();
  const completed = page.waitForResponse((r) => r.url().endsWith(`/api/texts/${created!.id}/complete`));
  await page.getByRole("button", { name: "Finish lesson" }).click();
  expect((await completed).ok()).toBe(true);
  await expect(page.getByText("4 new words marked as known.")).toBeVisible();
  await expect(wordAt(page, 1)).toHaveClass(/w-known/);
  for (const n of NAME_AT) await expect(wordAt(page, n)).toHaveClass(/w-ignored/);
  expect(await savedTerms(page, created)).not.toContain(t.name.toLowerCase());
});
