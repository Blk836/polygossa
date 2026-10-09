import { expect, test, type Page } from "@playwright/test";
import { bottomPager, cleanUp, createText, openReader, TALL, wordAt, type Created } from "./reader-helpers";

// docs/acceptance/reader-count-and-follow.feature: the known-words count in the top bar follows reading, without
// leaving the reader.

let created: Created | null = null;

test.afterEach(async ({ page }) => {
  await cleanUp(page, created);
  created = null;
});

test.use({ viewport: TALL }); // 250-word pages

/**
 * Other tests share the account and change its real count at any moment, so the header's count is stubbed: each
 * request answers 100 more than the last, and the tests check the reader asks again after a save and shows it.
 */
async function stubKnownCount(page: Page) {
  let calls = 0;
  await page.route("**/api/dashboard/header*", (route) => {
    calls++;
    return route.fulfill({ json: { current: 1, best: 1, activeToday: true, secondsLeftToday: 3600, knownWords: calls * 100 } });
  });
  const known = page.getByRole("banner").getByTestId("known-words");
  /** Waits for the count to change after `change`, then checks it shows the latest answer. */
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
  await header.updatesAfter(() => wordAt(page, 5).click()); // looking a word up saves it as learning
  await expect(wordAt(page, 5)).toHaveClass(/w-learning/);
  await header.updatesAfter(() => page.getByRole("button", { name: "Known", exact: true }).click());
  await expect(wordAt(page, 5)).toHaveClass(/w-known/);
});
