import { expect, test, type Page } from "@playwright/test";
import { bottomPager, cleanUp, createText, openReader, TALL, wordAt, type Created } from "./reader-helpers";

let created: Created | null = null;

test.afterEach(async ({ page }) => {
  await cleanUp(page, created);
  created = null;
});

test.use({ viewport: TALL });

async function stubKnownCount(page: Page) {
  let calls = 0;
  await page.route("**/api/dashboard/header*", (route) => {
    calls++;
    return route.fulfill({ json: { current: 1, best: 1, activeToday: true, secondsLeftToday: 3600, knownWords: calls * 100 } });
  });
  const known = page.getByRole("banner").getByTestId("known-words");
  const updatesAfter = async (change: () => Promise<unknown>) => {
    await expect(known).toHaveText(`${calls * 100} known`);
    const before = await known.textContent();
    await change();
    await expect(known).not.toHaveText(before!);
    await expect(known).toHaveText(`${calls * 100} known`);
  };
  return { updatesAfter };
}

test("turning a page that marks its words known updates the count in the top bar", async ({ page }) => {
  const header = await stubKnownCount(page);
  created = await createText(page);
  await openReader(page, `/read/${created.id}`);
  await header.updatesAfter(async () => {
    const saved = page.waitForResponse((r) => r.url().includes("/mark-known") && r.request().method() === "POST");
    await bottomPager(page).getByRole("button", { name: "Next page" }).click();
    expect((await saved).ok()).toBe(true);
  });
});

test("setting a word's status in the reader updates the count in the top bar", async ({ page }) => {
  const header = await stubKnownCount(page);
  created = await createText(page);
  await openReader(page, `/read/${created.id}`);
  await header.updatesAfter(() => wordAt(page, 5).click());
  await expect(wordAt(page, 5)).toHaveClass(/w-learning/);
  await header.updatesAfter(() => page.getByRole("button", { name: "Known", exact: true }).click());
  await expect(wordAt(page, 5)).toHaveClass(/w-known/);
});
