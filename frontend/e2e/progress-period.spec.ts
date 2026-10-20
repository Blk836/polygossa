import { expect, test, type Page } from "@playwright/test";

test.describe.configure({ mode: "default" });

let savedWord: number | null = null;

test.afterEach(async ({ page }) => {
  if (savedWord !== null) await page.request.delete(`/api/vocabulary/${savedWord}`);
  savedWord = null;
});

async function openProgress(page: Page) {
  await page.goto("/library");
  const me = await (await page.request.get("/api/me")).json();
  const language = me.targetLanguage ?? "es";
  const res = await page.request.post("/api/vocabulary", { data: { language, term: `periodo${Date.now()}`, status: "known" } });
  expect(res.ok(), await res.text()).toBe(true);
  savedWord = (await res.json()).id;
  const asked: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/api/dashboard?")) asked.push(new URL(r.url()).searchParams.get("period") ?? "");
  });
  await page.goto("/dashboard");
  return asked;
}

const distinct = (asked: string[]) => asked.filter((p, i) => p !== asked[i - 1]);

const picker = (page: Page) => page.getByRole("combobox", { name: "Period" });
const stats = (page: Page, label: string) => page.getByRole("region", { name: label, exact: true });

test("offers today, last week, month, quarter, year and all time, starting on last week", async ({ page }) => {
  const asked = await openProgress(page);
  await expect(picker(page).getByRole("option")).toHaveText(["Today", "Last week", "Last month", "Last quarter", "Last year", "All time"]);
  await expect(picker(page)).toHaveValue("week");
  await expect(stats(page, "Last week").getByRole("heading")).toHaveText("Last week");
  await expect(stats(page, "Last week").getByTestId("days-practised")).toHaveText(/^\d+ of 7$/);
  expect(distinct(asked)).toEqual(["week"]);
});

test("choosing last month shows the month's stats and growth", async ({ page }) => {
  const asked = await openProgress(page);
  await expect(stats(page, "Last week")).toBeVisible();
  await picker(page).selectOption("month");
  const month = stats(page, "Last month");
  await expect(month.getByTestId("days-practised")).toHaveText(/^[1-9]\d* of 30$/);
  await expect(month.getByTestId("words-learned")).not.toHaveText("0");
  await expect(month).toContainText(/the month before|start today/);
  await expect(page.getByRole("heading", { name: /words — last month$/ })).toBeVisible();
  expect(distinct(asked)).toEqual(["week", "month"]);
});

test("all time compares against nothing and counts days since joining", async ({ page }) => {
  await openProgress(page);
  await picker(page).selectOption("all");
  const all = stats(page, "All time");
  const days = (await (await page.request.get("/api/dashboard?period=all")).json()).period.days;
  await expect(all.getByTestId("days-practised")).toHaveText(new RegExp(`^\\d+ of ${days.toLocaleString("en-US")}$`));
  await expect(all.getByText("Since you joined")).toHaveCount(5);
  await expect(page.getByRole("heading", { name: /words — all time$/ })).toBeVisible();
});

test("changing the period leaves the streak alone", async ({ page }) => {
  await openProgress(page);
  const streak = await page.getByTestId("streak-count").textContent();
  await picker(page).selectOption("year");
  await expect(stats(page, "Last year")).toBeVisible();
  await expect(page.getByTestId("streak-count")).toHaveText(streak!);
});

test("a failing period request keeps the last stats and says so", async ({ page }) => {
  await openProgress(page);
  await expect(stats(page, "Last week")).toBeVisible();
  await page.route("**/api/dashboard?*period=quarter*", (route) => route.fulfill({ status: 500, json: { code: "internal", message: "Something went wrong" } }));
  await picker(page).selectOption("quarter");
  await expect(page.getByRole("alert").filter({ hasText: "Something went wrong" })).toBeVisible();
  await expect(page.getByTestId("streak-count")).toBeVisible();
});

async function stubToday(page: Page, current: Record<string, number>, previous: Record<string, number>) {
  await page.route("**/api/dashboard?*period=today*", async (route) => {
    const body = await (await route.fetch()).json();
    body.period.current = { ...body.period.current, ...current };
    body.period.previous = { ...body.period.previous, ...previous };
    await route.fulfill({ json: body });
  });
}

test("choosing today shows only today's figures, without days practised", async ({ page }) => {
  const asked = await openProgress(page);
  await expect(stats(page, "Last week")).toBeVisible();
  await stubToday(page, { wordsKnown: 4, readingSeconds: 300, wordsRead: 300, listenedSeconds: 120 }, {});
  await picker(page).selectOption("today");
  const today = stats(page, "Today");
  await expect(today.getByRole("heading")).toHaveText("Today");
  await expect(today.getByTestId("words-learned")).toHaveText("4");
  await expect(today.getByTestId("minutes-read")).toHaveText("5");
  await expect(today.getByTestId("words-read")).toHaveText("300");
  await expect(today.getByTestId("listening")).toHaveText("2 min");
  await expect(today.getByTestId("days-practised")).toHaveCount(0);
  await expect(today.getByText("Days practised")).toHaveCount(0);
  expect(distinct(asked)).toEqual(["week", "today"]);
});

test("today is compared with yesterday", async ({ page }) => {
  await openProgress(page);
  await stubToday(page,
    { readingSeconds: 900, listenedSeconds: 300, wordsKnown: 3, wordsRead: 40 },
    { readingSeconds: 600, listenedSeconds: 720, wordsKnown: 0, wordsRead: 40 });
  await picker(page).selectOption("today");
  const today = stats(page, "Today");
  await expect(today.getByText("+50% on yesterday")).toBeVisible();
  await expect(today.getByText("12 min yesterday")).toBeVisible();
  await expect(today.getByText("Up from nothing yesterday")).toBeVisible();
  await expect(today.getByText("Same as yesterday")).toBeVisible();
});

test("nothing done today or yesterday says start today on every tile", async ({ page }) => {
  await openProgress(page);
  const zero = { wordsKnown: 0, readingSeconds: 0, wordsRead: 0, listenedSeconds: 0 };
  await stubToday(page, zero, zero);
  await picker(page).selectOption("today");
  const today = stats(page, "Today");
  for (const id of ["words-learned", "minutes-read", "words-read"]) await expect(today.getByTestId(id)).toHaveText("0");
  await expect(today.getByTestId("listening")).toHaveText("0 min");
  await expect(today.getByText("Nothing yet — start today")).toHaveCount(4);
});

test("today keeps the last week's growth curve, streak, goal and all-time line", async ({ page }) => {
  await openProgress(page);
  await expect(stats(page, "Last week")).toBeVisible();
  const goal = page.getByRole("region", { name: "Today's goal" });
  const streak = await page.getByTestId("streak-count").textContent();
  const allTime = await page.getByTestId("all-time").textContent();
  const goalText = await goal.textContent();
  await picker(page).selectOption("today");
  await expect(stats(page, "Today")).toBeVisible();
  await expect(page.getByRole("heading", { name: /words — last week$/ })).toBeVisible();
  await expect(page.getByTestId("streak-count")).toHaveText(streak!);
  await expect(page.getByTestId("all-time")).toHaveText(allTime!);
  await expect(goal).toHaveText(goalText!);
});

test("a failing request for today keeps the last stats and says so", async ({ page }) => {
  await openProgress(page);
  await expect(stats(page, "Last week")).toBeVisible();
  await page.route("**/api/dashboard?*period=today*", (route) => route.fulfill({ status: 500, json: { code: "internal", message: "Something went wrong" } }));
  await picker(page).selectOption("today");
  await expect(page.getByRole("alert").filter({ hasText: "Something went wrong" })).toBeVisible();
  await expect(page.getByTestId("streak-count")).toBeVisible();
  await expect(stats(page, "Last week")).toBeVisible();
});
