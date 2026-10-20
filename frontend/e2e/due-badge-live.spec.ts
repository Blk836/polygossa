import { expect, test, type Page } from "@playwright/test";

const practice = (page: Page) =>
  page.getByRole("banner").getByRole("navigation", { name: "Main" }).getByRole("link", { name: /^Practice/ });

const stats = (dueWords: number) => ({ dueWords, reviewedToday: 0, dailyGoal: 20, goalMet: false, streak: 0, history: [], wordsInAnki: 0 });

const card = (id: number) => ({ type: "word", kind: "word", id, language: "es", front: `palabra${id}`, definition: `word ${id}`,
  dueAt: "2026-10-10T00:00:00Z", repetitions: 0 });

async function stubSession(page: Page, dueAfterEachAnswer: number[]) {
  let due = 2;
  await page.route("**/api/review/queue*", (route) => route.fulfill({ json: [card(1), card(2)] }));
  await page.route("**/api/review/stats*", (route) => route.fulfill({ json: stats(due) }));
  await page.route("**/api/review/word/*", (route) => {
    due = dueAfterEachAnswer.shift() ?? due;
    return route.fulfill({ json: { dueAt: "2026-10-30T00:00:00Z", intervalDays: 1, graduated: false, stats: stats(due) } });
  });
}

async function answer(page: Page, rating: "Easy" | "Forgot") {
  const box = page.locator("[data-tour=review-card]");
  await box.getByRole("button", { name: /Show answer/ }).click();
  await box.getByRole("button", { name: new RegExp(`^${rating}`) }).click();
}

test("the badge falls as cards are answered and goes with the last one", async ({ page }) => {
  await stubSession(page, [1, 0]);
  await page.goto("/review");
  await expect(practice(page).getByTestId("due-badge")).toHaveText("2");
  await answer(page, "Easy");
  await expect(practice(page).getByTestId("due-badge")).toHaveText("1");
  await answer(page, "Easy");
  await expect(page.getByText("All caught up!")).toBeVisible();
  await expect(practice(page).getByTestId("due-badge")).toHaveCount(0);
  await expect(practice(page)).toHaveAccessibleName("Practice");
});

test("an answer that leaves the same number due keeps the badge", async ({ page }) => {
  await stubSession(page, [2]);
  await page.goto("/review");
  await expect(practice(page).getByTestId("due-badge")).toHaveText("2");
  await answer(page, "Forgot");
  await expect(page.locator("[data-tour=review-card]").getByRole("button", { name: /Show answer/ })).toBeVisible();
  await expect(practice(page).getByTestId("due-badge")).toHaveText("2");
});
