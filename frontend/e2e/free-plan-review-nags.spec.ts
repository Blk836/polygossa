import { expect, test, type Browser, type Page } from "@playwright/test";
import { signUp } from "./photo-helpers";
import { createText, openReader, TALL } from "./reader-helpers";

const practice = (page: Page) =>
  page.getByRole("banner").getByRole("navigation", { name: "Main" }).getByRole("link", { name: /^Practice/ });

async function stubDue(page: Page, dueWords: number) {
  await page.route("**/api/review/stats*", (route) =>
    route.fulfill({ json: { dueWords, reviewedToday: 0, dailyGoal: 20, goalMet: false, streak: 0, history: [] } }),
  );
}

async function person(browser: Browser, tier: "FREE" | "PRO") {
  const p = await signUp(browser, `${tier} learner`, TALL);
  if (tier === "PRO") expect((await p.context.request.post("/api/me/plan", { data: { tier } })).ok()).toBe(true);
  return p;
}

test("a free account sees no due count on the Practice tab", async ({ browser }) => {
  const { context, page } = await person(browser, "FREE");
  await stubDue(page, 6);
  await page.goto("/library");
  await expect(practice(page)).toHaveAccessibleName("Practice");
  await expect(practice(page).getByTestId("due-badge")).toHaveCount(0);
  await context.close();
});

test("a Pro account still sees the due count", async ({ browser }) => {
  const { context, page } = await person(browser, "PRO");
  await stubDue(page, 3);
  await page.goto("/library");
  await expect(practice(page).getByTestId("due-badge")).toHaveText("3");
  await context.close();
});

test("a new free account's goal on Progress is words read", async ({ browser }) => {
  const { context, page } = await person(browser, "FREE");
  await page.goto("/dashboard");
  await expect(page.getByText("0 / 1,000 words read")).toBeVisible();
  await expect(page.locator("main")).not.toContainText("0 / 20 reviews");
  await context.close();
});

test("Settings offers no review goal on the free plan", async ({ browser }) => {
  const { context, page } = await person(browser, "FREE");
  await page.goto("/settings");
  const measures = page.getByLabel("Daily goal measures");
  await expect(measures.locator("option")).toHaveText(["Words read", "Minutes read", "Minutes listened"]);
  await expect(measures).toHaveValue("words_read");
  await context.close();
});

test("Settings still offers reviews on Pro", async ({ browser }) => {
  const { context, page } = await person(browser, "PRO");
  await page.goto("/settings");
  const measures = page.getByLabel("Daily goal measures");
  await expect(measures.locator("option")).toHaveText(["Reviews", "Words read", "Minutes read", "Minutes listened"]);
  await expect(measures).toHaveValue("reviews");
  await context.close();
});

for (const [tier, link, href] of [
  ["FREE", "See your words", "/vocabulary"],
  ["PRO", "Review your words", "/review"],
] as const) {
  test(`lesson complete on ${tier} offers "${link}"`, async ({ browser }) => {
    const { context, page } = await person(browser, tier);
    const created = await createText(page);
    await openReader(page, `/read/${created.id}?page=4`);
    await page.getByRole("button", { name: "Finish lesson" }).click();
    const summary = page.locator("[data-finish=summary]");
    await expect(summary.getByRole("link", { name: link })).toHaveAttribute("href", href);
    const other = tier === "FREE" ? "Review your words" : "See your words";
    await expect(summary.getByRole("link", { name: other })).toHaveCount(0);
    await context.close();
  });
}
