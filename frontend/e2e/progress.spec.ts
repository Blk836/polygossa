import { expect, test, type Page } from "@playwright/test";

let savedWord: number | null = null;

async function saveWordToday(page: Page) {
  await page.goto("/library");
  const res = await page.request.post("/api/vocabulary", {
    data: { language: "es", term: `progreso${Date.now()}${Math.floor(Math.random() * 1e6)}` },
  });
  expect(res.ok(), await res.text()).toBe(true);
  savedWord = (await res.json()).id;
}

test.afterEach(async ({ page }) => {
  if (savedWord !== null) await page.request.delete(`/api/vocabulary/${savedWord}`);
  savedWord = null;
});

test("practising today lights today's streak day and credits it", async ({ page }) => {
  await saveWordToday(page);
  await page.goto("/dashboard");
  const streak = page.getByRole("region", { name: "Daily streak" });
  await expect(streak).toBeVisible();
  expect(Number(await streak.getByTestId("streak-count").textContent())).toBeGreaterThanOrEqual(1);
  await expect(streak.getByTestId("streak-message")).toContainText(/^Day \d+ done/);
  const days = streak.getByRole("list", { name: "Last 7 days" }).getByRole("listitem");
  await expect(days).toHaveCount(7);
  await expect(days.last()).toContainText("Today");
  await expect(days.last().locator("[data-active]")).toHaveAttribute("data-active", "true");
  await expect(streak.getByRole("link", { name: "Continue reading" })).toHaveCount(0);
  const best = Number(await streak.getByTestId("best-streak").textContent());
  expect(best).toBeGreaterThanOrEqual(Number(await streak.getByTestId("streak-count").textContent()));
});

test("the page leads with motivation, not sessions", async ({ page }) => {
  await saveWordToday(page);
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Progress" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Known words" }).getByRole("progressbar")).toBeVisible();
  await expect(page.getByRole("region", { name: "Known words" }).getByTestId("milestone")).toContainText(/more to reach/);
  const week = page.getByRole("region", { name: "Last week" });
  for (const label of ["Words learned", "Minutes read", "Days practised"]) await expect(week).toContainText(label);
  await expect(page.getByRole("region", { name: "Activity" }).locator("[data-level]")).toHaveCount(84);
  await expect(page.locator("main")).not.toContainText(/session/i);
  await expect(page.locator("main")).not.toContainText("Review streak");
  await expect(page.locator("main")).not.toContainText("Texts imported");
});

test("the known-words card follows the language picked in the top bar", async ({ page }) => {
  await page.goto("/library");
  const me = await (await page.request.get("/api/me")).json();
  const real = await (await page.request.get("/api/dashboard")).json();
  const languages = [
    { language: "fr", known: 56, learning: 1, ignored: 0, sessions: 0, readingSeconds: 0 },
    ...["es", "de", "it", "pt", "ja", "zh", "ko"].map((language, i) => ({ language, known: 1000 + i, learning: 0, ignored: 0, sessions: 0, readingSeconds: 0 })),
  ];
  await page.route("**/api/dashboard*", (route) => route.fulfill({ json: { ...real, languages, growth: [] } }));
  await page.goto("/dashboard");
  const expected = languages.find((l) => l.language === (me.targetLanguage ?? "fr"))!.known;
  await expect(page.getByRole("region", { name: "Known words" }).getByTestId("known-words")).toHaveText(expected.toLocaleString("en-US"));
  await expect(page.getByRole("region", { name: "Known words" }).getByTestId("milestone")).toContainText(
    expected === 56 ? "44 more to reach 100" : `more to reach 1,500`,
  );
});

test("the page fits a phone without sideways scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/dashboard");
  await expect(page.getByRole("region", { name: "Daily streak" })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
