import { expect, test, type Page } from "@playwright/test";

// The Progress page's period picker: the stats card (words learned, minutes read, days practised) and the growth
// curve cover the last week (default), month, quarter, year or all time.

let savedWord: number | null = null;

test.afterEach(async ({ page }) => {
  if (savedWord !== null) await page.request.delete(`/api/vocabulary/${savedWord}`);
  savedWord = null;
});

/** Opens Progress with a word known today (so there is a growth curve), recording which periods were asked for. */
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

/** The periods asked for, in order. Dev mode's Strict Mode runs each effect twice, so one choice can ask twice in a row. */
const distinct = (asked: string[]) => asked.filter((p, i) => p !== asked[i - 1]);

const picker = (page: Page) => page.getByRole("combobox", { name: "Period" });
const stats = (page: Page, label: string) => page.getByRole("region", { name: label });

test("offers last week, month, quarter, year and all time, starting on last week", async ({ page }) => {
  const asked = await openProgress(page);
  await expect(picker(page).getByRole("option")).toHaveText(["Last week", "Last month", "Last quarter", "Last year", "All time"]);
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
  await expect(all.getByText("Since you joined")).toHaveCount(5); // one per tile
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
  // Next.js keeps its own (empty) route announcer alert on every page, so pick ours by its message.
  await expect(page.getByRole("alert").filter({ hasText: "Something went wrong" })).toBeVisible();
  await expect(page.getByTestId("streak-count")).toBeVisible();
});
