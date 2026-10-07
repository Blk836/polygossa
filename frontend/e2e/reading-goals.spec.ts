import { expect, test, type Page } from "@playwright/test";
import { addSyncedAudio, cleanUp, createText, openReader, player, type Created } from "./reader-helpers";

// docs/acceptance/reading-listening-goals.feature: words read, time listened and the daily goal.

/** The real dashboard, with today's goal replaced by the test's (the shared account's goal must not change). */
async function stubGoal(page: Page, goal: { kind: string; target: number; done: number; met: boolean }) {
  await page.route("**/api/dashboard?*", async (route) => {
    const res = await route.fetch();
    const json = await res.json();
    await route.fulfill({ response: res, json: { ...json, goal } });
  });
}

test("Progress shows today's goal, words read and listening", async ({ page }) => {
  await page.goto("/library");
  await stubGoal(page, { kind: "words_read", target: 1000, done: 340, met: false });
  await page.goto("/dashboard");
  const card = page.getByRole("region", { name: "Today's goal" });
  await expect(card).toContainText("340 / 1,000 words read");
  await expect(card.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "34");
  const week = page.getByRole("region", { name: "Last week" });
  await expect(week.getByTestId("words-read")).toHaveText(/^\d[\d,]*$/);
  await expect(week.getByTestId("listening")).toHaveText(/^\d+ min$|^\d+ h \d+ min$/);
  await expect(page.getByTestId("all-time")).toContainText("words read");
  await expect(page.getByTestId("all-time")).toContainText("listening");
});

test("a reached goal says so", async ({ page }) => {
  await page.goto("/library");
  await stubGoal(page, { kind: "minutes_listened", target: 30, done: 31, met: true });
  await page.goto("/dashboard");
  await expect(page.getByRole("region", { name: "Today's goal" })).toContainText("Goal reached");
});

test("Settings › Profile chooses what the daily goal measures", async ({ page }) => {
  await page.goto("/library");
  const me = await (await page.request.get("/api/me")).json();
  let sent: Record<string, unknown> | null = null;
  await page.route("**/api/me", (route) => {
    if (route.request().method() !== "PATCH") return route.continue();
    sent = route.request().postDataJSON();
    return route.fulfill({ json: { ...me, ...sent } });
  });
  await page.goto("/settings");
  await expect(page.getByLabel("Daily goal measures")).toHaveValue("reviews");
  await page.getByLabel("Daily goal measures").selectOption("words_read");
  await page.getByLabel("Daily goal target").fill("1000");
  await page.getByLabel("Only count days I reach my daily goal").check();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  expect(sent).toMatchObject({ dailyGoal: { kind: "words_read", target: 1000 }, streakNeedsGoal: true });
});

test.describe("listening", () => {
  let created: Created | null = null;
  test.afterEach(async ({ page }) => {
    await cleanUp(page, created);
    created = null;
  });

  test("playing audio is reported as listening time when the reader closes", async ({ page }) => {
    created = await createText(page, 40);
    await addSyncedAudio(page, created.id);
    // The last heartbeat goes as a beacon when the reader closes, so the backend's total is what's checked.
    const listened = async () => {
      const days = (await (await page.request.get("/api/dashboard")).json()).activity.days;
      return days[days.length - 1].listenedSeconds as number;
    };
    const before = await listened();
    await openReader(page, `/read/${created.id}`);
    await player(page).getByRole("button", { name: "Play", exact: true }).click();
    await expect(player(page).getByRole("button", { name: "Pause", exact: true })).toBeVisible();
    await page.waitForTimeout(3000);
    await page.goto("/library");

    await expect.poll(listened).toBeGreaterThanOrEqual(before + 2);
  });
});
