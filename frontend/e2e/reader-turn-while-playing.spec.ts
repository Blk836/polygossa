import { expect, test, type Page } from "@playwright/test";
import { addSyncedAudio, article, cleanUp, createText, openReader, PAGE, pager, player, setReaderCookie, TALL, wordAt, type Created } from "./reader-helpers";

let created: Created | null = null;

test.use({ viewport: TALL });

test.afterEach(async ({ page }) => {
  await cleanUp(page, created);
  created = null;
});

async function openWithAudio(page: Page, path = "") {
  created = await createText(page);
  await addSyncedAudio(page, created.id, 1000);
  await openReader(page, `/read/${created.id}${path}`);
}

async function play(page: Page) {
  await player(page).getByRole("button", { name: "Play", exact: true }).click();
}

async function speakingIndex(page: Page) {
  const spoken = article(page).locator(".w-speaking");
  await expect(spoken).toHaveCount(1);
  return Number(await spoken.getAttribute("data-i")) / 2;
}

async function staysOn(page: Page, n: number, firstWord: number) {
  await expect(pager(page)).toContainText(`Page ${n} of 4`);
  await expect.poll(() => speakingIndex(page)).toBeGreaterThanOrEqual(firstWord);
  await page.waitForTimeout(2_500);
  await expect(pager(page)).toContainText(`Page ${n} of 4`);
  const spoken = await speakingIndex(page);
  expect(spoken).toBeGreaterThanOrEqual(firstWord);
  expect(spoken).toBeLessThan(firstWord + 10);
}

test.describe("with marking pages known off", () => {
  test.beforeEach(async ({ page }) => {
    await setReaderCookie(page, "known%3D0");
  });

  test("Next while playing stays on the next page and plays from its start", async ({ page }) => {
    await openWithAudio(page);
    await play(page);
    await expect(wordAt(page, 1)).toHaveClass(/w-speaking/, { timeout: 5_000 });
    await pager(page).getByRole("button", { name: "Next page" }).click();
    await staysOn(page, 2, PAGE);
    await expect(player(page).getByRole("button", { name: "Pause" })).toBeVisible();
  });

  test("Previous while playing stays on the previous page and plays from its start", async ({ page }) => {
    await openWithAudio(page, "?page=2");
    await play(page);
    await expect(wordAt(page, PAGE + 1)).toHaveClass(/w-speaking/, { timeout: 5_000 });
    await pager(page).getByRole("button", { name: "Previous page" }).click();
    await staysOn(page, 1, 0);
  });

  test("the right arrow key while playing behaves like Next", async ({ page }) => {
    await openWithAudio(page);
    await play(page);
    await expect(wordAt(page, 1)).toHaveClass(/w-speaking/, { timeout: 5_000 });
    await page.keyboard.press("ArrowRight");
    await staysOn(page, 2, PAGE);
  });

  test("turning the page while paused, then pressing Play, plays the page shown", async ({ page }) => {
    await openWithAudio(page);
    await play(page);
    await expect(wordAt(page, 1)).toHaveClass(/w-speaking/, { timeout: 5_000 });
    await player(page).getByRole("button", { name: "Pause" }).click();
    await pager(page).getByRole("button", { name: "Next page" }).click();
    await expect(pager(page)).toContainText("Page 2 of 4");
    await play(page);
    await staysOn(page, 2, PAGE);
  });
});

test("Next while playing marks the page known once, as without audio", async ({ page }) => {
  const calls: unknown[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/mark-known") && r.method() === "POST") calls.push(r.postDataJSON());
  });
  await openWithAudio(page);
  await play(page);
  await expect(wordAt(page, 1)).toHaveClass(/w-speaking/, { timeout: 5_000 });
  await pager(page).getByRole("button", { name: "Next page" }).click();
  await staysOn(page, 2, PAGE);
  expect(calls).toHaveLength(1);
});
