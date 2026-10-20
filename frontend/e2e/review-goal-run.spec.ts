import { expect, test, type Page } from "@playwright/test";

async function stubStats(page: Page, streak: number) {
  await page.route("**/api/review/queue*", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/review/stats*", (route) => route.fulfill({
    json: { dueWords: 0, reviewedToday: 0, dailyGoal: 20, goalMet: false, streak, history: [], wordsInAnki: 0 },
  }));
}

const goalBar = (page: Page) => page.locator("[data-tour=review-goal]");

test("the review goal bar names its run instead of showing a second day streak", async ({ page }) => {
  await stubStats(page, 0);
  await page.goto("/review");
  await expect(goalBar(page).getByTestId("review-goal-run")).toHaveText("0 days in a row at goal");
  await expect(goalBar(page).locator("[title='Day streak']")).toHaveCount(0);
  await expect(goalBar(page).locator("svg path[d^='M12 22a7 7']")).toHaveCount(0);
});

test("one day at goal reads in the singular", async ({ page }) => {
  await stubStats(page, 1);
  await page.goto("/review");
  await expect(goalBar(page).getByTestId("review-goal-run")).toHaveText("1 day in a row at goal");
});
