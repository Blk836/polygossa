import { expect, test, type Locator, type Page } from "@playwright/test";
import { article, cleanUp, createVideo, openReader, pager, player, TALL, wordAt, type Created } from "./reader-helpers";

// Video lessons use the same reader as texts: header, settings, pager, word card and player bar; only the player
// itself is added (beside the text on wide screens, above it on narrow ones).

let created: Created | null = null;

test.afterEach(async ({ page }) => {
  await cleanUp(page, created);
  created = null;
});

const settingsButton = (page: Page) => page.getByRole("button", { name: "Reader settings" });
const shortcutsMenu = (page: Page) => page.getByRole("dialog", { name: "Keyboard shortcuts" });

async function box(locator: Locator) {
  const b = await locator.boundingBox();
  if (!b) throw new Error("element is not visible");
  return b;
}

test.describe("video lessons use the same reader", () => {
  test("wide screens put the video beside the text, with the same header, pager and player bar", async ({ page }) => {
    await page.setViewportSize(TALL); // 250-word pages
    created = await createVideo(page);
    await openReader(page, `/read/${created.id}`);
    const dock = page.getByTestId("video-dock");
    const text = await box(article(page));
    expect((await box(dock)).x).toBeGreaterThanOrEqual(text.x + text.width);
    await expect(settingsButton(page)).toBeVisible();
    await expect(pager(page)).toContainText("Page 1 of 4");
    await page.getByRole("button", { name: "Keyboard shortcuts" }).click();
    await expect(shortcutsMenu(page)).toContainText("Play / pause");
    await page.keyboard.press("Escape");
    // The YouTube embed may be unreachable; the transcript and its explanation stay usable either way.
    const failed = page.getByText("The video can't be played here");
    await expect(player(page).or(failed)).toBeVisible();
    if (await player(page).isVisible()) {
      for (const name of ["Previous sentence", "Next sentence", "Replay sentence", "Loop sentence"]) {
        await expect(player(page).getByRole("button", { name, exact: true }), name).toBeVisible();
      }
      await expect(player(page).getByRole("combobox", { name: "Speed" })).toBeVisible();
    }
  });

  test("narrow screens keep the video above the text with no sideways scroll", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    created = await createVideo(page);
    await openReader(page, `/read/${created.id}`);
    const dock = await box(page.getByTestId("video-dock"));
    expect(dock.y + dock.height).toBeLessThanOrEqual((await box(article(page))).y);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });

  test("the video's player bar and word lookups work like an audio text's", async ({ page }) => {
    created = await createVideo(page);
    await openReader(page, `/read/${created.id}`);
    await expect(player(page).getByRole("button", { name: "Next sentence" })).toBeEnabled(); // captions are synced
    await expect(player(page).getByRole("group", { name: "Sentence timeline" })).toHaveCount(0);
    await wordAt(page, 3).click();
    await expect(page.getByRole("button", { name: "Close", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Play from here" })).toBeVisible();
  });
});
