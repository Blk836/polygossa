import { expect, test, type Page } from "@playwright/test";

// The landing page showreel (landing-showreel.feature): an animation that plays by itself below the hero. Its root
// exposes the scene playing (data-scene), whether it is ticking (data-running) and how far into the scene it is
// (data-progress), so tests can check the timeline without screenshots.
const reel = (page: Page) => page.getByTestId("showreel");
const step = (page: Page, caption: string) => reel(page).getByRole("button", { name: caption });

const CAPTIONS = [
  "Watch something you love",
  "Tap the words you don't know",
  "Review in seconds",
  "Meet them again",
  "Understand more every week",
];

async function openInView(page: Page) {
  await page.goto("/");
  await reel(page).scrollIntoViewIfNeeded();
  await expect(reel(page)).toHaveAttribute("data-running", "true");
}

test.describe("landing showreel", () => {
  test("sits between the hero and How it works, with a header link", async ({ page }) => {
    await page.goto("/");
    const ids = await page.locator("main > section").evaluateAll((s) => s.map((el) => el.id));
    expect(ids.indexOf("watch")).toBe(1);
    expect(ids.indexOf("how")).toBe(2);
    await expect(page.getByRole("banner").getByRole("link", { name: "See it in action" })).toHaveAttribute("href", "#watch");
    await expect(reel(page)).toHaveAttribute("role", "region");
    await expect(reel(page)).toHaveAccessibleName(/See it in action/);
  });

  test("lists the five scenes as steps and plays them by itself", async ({ page }) => {
    await openInView(page);
    await expect(reel(page).getByRole("list", { name: "Scenes" }).getByRole("button")).toHaveText(CAPTIONS.map((c, i) => `${i + 1}${c}`));
    await expect(reel(page)).toHaveAttribute("data-scene", "watch");
    await expect(step(page, CAPTIONS[0])).toHaveAttribute("aria-current", "step");
    // scene 1 lasts 5 s
    await expect(reel(page)).toHaveAttribute("data-scene", "tap", { timeout: 8000 });
    await expect(step(page, CAPTIONS[1])).toHaveAttribute("aria-current", "step");
    await expect(reel(page).getByTestId("showreel-caption")).toHaveText(CAPTIONS[1]);
  });

  test("scene 1 highlights the spoken subtitle word, moving forward", async ({ page }) => {
    await openInView(page);
    const spoken = reel(page).locator(".w-speaking");
    await expect(spoken).toHaveCount(1);
    const first = await spoken.textContent();
    await expect(spoken).not.toHaveText(first!, { timeout: 3000 });
  });

  test("scene 2 taps a new word: definition, learning colour, saved note", async ({ page }) => {
    await openInView(page);
    await step(page, CAPTIONS[1]).click();
    await expect(reel(page)).toHaveAttribute("data-scene", "tap");
    const word = reel(page).getByTestId("showreel-target");
    await expect(word).toHaveText("mariscos");
    await expect(word).toHaveClass(/w-new/);
    await expect(reel(page).getByTestId("showreel-card")).toContainText("seafood", { timeout: 5000 });
    await expect(word).toHaveClass(/w-learning/);
    await expect(reel(page).getByText("Saved to your words")).toBeVisible({ timeout: 5000 });
  });

  test("scene 3 turns a review card over and schedules the next review", async ({ page }) => {
    await openInView(page);
    await step(page, CAPTIONS[2]).click();
    await expect(reel(page)).toHaveAttribute("data-scene", "review");
    await expect(reel(page).getByText("Next review in 4 days")).toBeVisible({ timeout: 5000 });
    await expect(reel(page).getByTestId("showreel-answer")).toHaveText("seafood");
  });

  test("scene 4 shows the word known and counts up to 1,284", async ({ page }) => {
    await openInView(page);
    await step(page, CAPTIONS[3]).click();
    await expect(reel(page)).toHaveAttribute("data-scene", "again");
    const word = reel(page).getByTestId("showreel-target");
    await expect(word).toHaveText("mariscos");
    await expect(word).toHaveClass(/w-known/);
    await expect(reel(page).getByTestId("showreel-count")).toHaveText("1,284", { timeout: 5000 });
  });

  test("scene 5 shows the payoff, the research and a sign-up button", async ({ page }) => {
    await openInView(page);
    await step(page, CAPTIONS[4]).click();
    await expect(reel(page)).toHaveAttribute("data-scene", "payoff");
    await expect(reel(page).getByTestId("showreel-day1")).toHaveText("72%", { timeout: 6000 });
    await expect(reel(page).getByTestId("showreel-day60")).toHaveText("97%", { timeout: 6000 });
    const newWords = async (id: string) => reel(page).getByTestId(id).locator("xpath=ancestor::figure[1]").locator(".w-new").count();
    expect(await newWords("showreel-day60")).toBeLessThan(await newWords("showreel-day1"));
    await expect(reel(page).getByText(/example/i).first()).toBeVisible();
    await expect(reel(page).getByText(/98%/).first()).toBeVisible();
    await expect(reel(page).getByText(/Hu & Nation/)).toBeVisible();
    await expect(reel(page).getByRole("link", { name: "Start reading free" })).toHaveAttribute("href", "/signup");
  });

  test("starts again from the first scene after the last", async ({ page }) => {
    await openInView(page);
    await step(page, CAPTIONS[4]).click();
    await expect(reel(page)).toHaveAttribute("data-scene", "watch", { timeout: 10_000 });
  });

  test("pause stops it and play resumes from the same point", async ({ page }) => {
    await openInView(page);
    await reel(page).getByRole("button", { name: "Pause" }).click();
    await expect(reel(page)).toHaveAttribute("data-running", "false");
    const at = await reel(page).getAttribute("data-progress");
    await page.waitForTimeout(1000);
    await expect(reel(page)).toHaveAttribute("data-progress", at!);
    await reel(page).getByRole("button", { name: "Play" }).click();
    await expect(reel(page)).toHaveAttribute("data-running", "true");
    await expect(reel(page)).not.toHaveAttribute("data-progress", at!);
    expect(Number(await reel(page).getAttribute("data-progress"))).toBeGreaterThan(Number(at));
  });

  test("steps work from the keyboard", async ({ page }) => {
    await openInView(page);
    await step(page, CAPTIONS[2]).focus();
    await page.keyboard.press("Enter");
    await expect(reel(page)).toHaveAttribute("data-scene", "review");
    await expect(step(page, CAPTIONS[2])).toHaveAttribute("aria-current", "step");
  });

  test("does not run while scrolled out of view", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 600 });
    await page.goto("/");
    await page.getByRole("contentinfo").scrollIntoViewIfNeeded();
    await expect(reel(page)).toHaveAttribute("data-running", "false");
    await reel(page).scrollIntoViewIfNeeded();
    await expect(reel(page)).toHaveAttribute("data-running", "true");
  });

  test("with reduced motion it waits, fully drawn, and can be stepped through", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await reel(page).scrollIntoViewIfNeeded();
    await expect(reel(page).getByRole("button", { name: "Play" })).toBeVisible();
    await expect(reel(page)).toHaveAttribute("data-running", "false");
    await expect(reel(page)).toHaveAttribute("data-scene", "watch");
    await step(page, CAPTIONS[1]).click();
    // fully drawn: the definition card is there at once
    await expect(reel(page).getByTestId("showreel-card")).toContainText("seafood");
    await expect(reel(page)).toHaveAttribute("data-scene", "tap");
  });

  test("announces the caption politely and hides the decoration", async ({ page }) => {
    await page.goto("/");
    await expect(reel(page).getByTestId("showreel-caption")).toHaveAttribute("aria-live", "polite");
    await expect(reel(page).getByTestId("showreel-stage")).toHaveAttribute("aria-hidden", "true");
  });

  test("fits a phone without horizontal scrolling", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openInView(page);
    for (const caption of CAPTIONS) {
      await step(page, caption).click();
      await page.waitForTimeout(300);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, caption).toBeLessThanOrEqual(0);
    }
  });
});
