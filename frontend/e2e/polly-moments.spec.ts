import { expect, test, type Page } from "@playwright/test";
import { bottomPager, cleanUp, createText, createTextWith, openReader, TALL, wordAt, type Created } from "./reader-helpers";

const HOUR = 3600;
const banner = (page: Page) => page.getByRole("banner");
const known = (page: Page) => banner(page).getByTestId("known-words");
const jar = (page: Page) => banner(page).getByTestId("honey-jar");
const milestone = (page: Page) => page.getByRole("dialog");

interface Header { knownWords: number; current: number; activeToday: boolean; calls: number; language: string | null }

async function stubHeader(page: Page, start: Partial<Header> = {}, perLanguage?: Record<string, number>): Promise<Header> {
  const h: Header = { knownWords: 10, current: 1, activeToday: true, calls: 0, language: null, ...start };
  await page.route("**/api/dashboard/header*", (route) => {
    h.calls++;
    h.language = new URL(route.request().url()).searchParams.get("language");
    const knownWords = perLanguage && h.language ? perLanguage[h.language] ?? 0 : h.knownWords;
    return route.fulfill({ json: { current: h.current, best: h.current, activeToday: h.activeToday, secondsLeftToday: HOUR, knownWords } });
  });
  return h;
}

async function moveSection(page: Page, name = "Explore") {
  await page.getByRole("navigation", { name: "Section" }).getByRole("link", { name }).click();
}

async function recordFlights(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { flights: number };
    w.flights = 0;
    new MutationObserver((records) => {
      for (const r of records) for (const n of r.addedNodes) if (n instanceof Element && n.matches("[data-testid=polly-flight]")) w.flights++;
    }).observe(document, { childList: true, subtree: true });
  });
  return () => page.evaluate(() => (window as unknown as { flights: number }).flights);
}

test.describe("known-word milestones", () => {
  test("reaching 100 known words shows a proud Polly once, and Keep reading puts me back where I was", async ({ page }) => {
    const h = await stubHeader(page, { knownWords: 99 });
    await page.goto("/library");
    await expect(known(page)).toHaveText("99 known");
    h.knownWords = 100;
    await moveSection(page);
    await expect(milestone(page)).toHaveAccessibleName("100 words known");
    await expect(milestone(page).locator('svg[data-polly="proud"]')).toBeVisible();
    await expect(milestone(page).getByRole("button", { name: "Keep reading" })).toBeFocused();
    await milestone(page).getByRole("button", { name: "Keep reading" }).click();
    await expect(milestone(page)).toHaveCount(0);
    await expect(page).toHaveURL(/\/community/);

    h.knownWords = 99;
    await moveSection(page, "Library");
    await expect(known(page)).toHaveText("99 known");
    h.knownWords = 100;
    await moveSection(page);
    await expect(known(page)).toHaveText("100 known");
    await expect(milestone(page)).toHaveCount(0);
  });

  test("Escape closes the milestone", async ({ page }) => {
    const h = await stubHeader(page, { knownWords: 498 });
    await page.goto("/library");
    await expect(known(page)).toHaveText("498 known");
    h.knownWords = 503;
    await moveSection(page);
    await expect(milestone(page)).toHaveAccessibleName("500 words known");
    await page.keyboard.press("Escape");
    await expect(milestone(page)).toHaveCount(0);
  });

  test("passing two milestones at once shows only the higher one", async ({ page }) => {
    const h = await stubHeader(page, { knownWords: 480 });
    await page.goto("/library");
    await expect(known(page)).toHaveText("480 known");
    h.knownWords = 1020;
    await moveSection(page);
    await expect(milestone(page)).toHaveAccessibleName("1,000 words known");
    await expect(page.getByRole("dialog")).toHaveCount(1);
  });

  test("a milestone seen in another language still shows in this one, but not one seen in this one", async ({ page }) => {
    const h = await stubHeader(page, { knownWords: 999 });
    await page.goto("/library");
    await expect(known(page)).toHaveText("999 known");
    const language = h.language!;
    await page.evaluate((lang) => {
      localStorage.setItem("polly-milestones:zz", JSON.stringify([100, 500, 1000]));
      localStorage.setItem(`polly-milestones:${lang}`, JSON.stringify([100, 500]));
    }, language);
    h.knownWords = 1000;
    await moveSection(page);
    await expect(milestone(page)).toHaveAccessibleName("1,000 words known");
    const seen = await page.evaluate((lang) => localStorage.getItem(`polly-milestones:${lang}`), language);
    expect(JSON.parse(seen!)).toEqual([100, 500, 1000]);
  });

  test("with reduce motion on, the milestone still shows", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const h = await stubHeader(page, { knownWords: 99 });
    await page.goto("/library");
    await expect(known(page)).toHaveText("99 known");
    h.knownWords = 100;
    await moveSection(page);
    await expect(milestone(page)).toHaveAccessibleName("100 words known");
  });
});

test.describe("streaks", () => {
  test("keeping a streak shows a cheering Polly that goes away by itself", async ({ page }) => {
    const h = await stubHeader(page, { current: 6, activeToday: false });
    await page.goto("/library");
    await expect(banner(page).getByTestId("streak-flame")).toHaveAttribute("data-state", "fading");
    Object.assign(h, { current: 7, activeToday: true });
    await moveSection(page);
    const toast = page.getByRole("status").filter({ hasText: "7-day streak kept" });
    await expect(toast).toContainText("Come back tomorrow to make it 8.");
    await expect(toast.locator('svg[data-polly="cheering"]')).toBeVisible();
    await expect(toast).toHaveCount(0, { timeout: 15_000 });
    await moveSection(page, "Library");
    await expect(page.getByText("7-day streak kept")).toHaveCount(0);
  });

  test("the streak message can be closed", async ({ page }) => {
    const h = await stubHeader(page, { current: 2, activeToday: false });
    await page.goto("/library");
    await expect(banner(page).getByTestId("streak-flame")).toHaveAttribute("data-state", "fading");
    Object.assign(h, { current: 3, activeToday: true });
    await moveSection(page);
    const toast = page.getByRole("status").filter({ hasText: "3-day streak kept" });
    await toast.getByRole("button", { name: "Close" }).click();
    await expect(toast).toHaveCount(0);
  });

  test("starting a streak says it started", async ({ page }) => {
    const h = await stubHeader(page, { current: 0, activeToday: false });
    await page.goto("/library");
    await expect(banner(page).getByTestId("streak-flame")).toHaveAttribute("data-state", "out");
    Object.assign(h, { current: 1, activeToday: true });
    await moveSection(page);
    await expect(page.getByRole("status").filter({ hasText: "Streak started" })).toBeVisible();
    await expect(page.getByText(/streak kept/)).toHaveCount(0);
  });
});

test.describe("a small Polly flies to the jar", () => {
  let created: Created | null = null;
  test.afterEach(async ({ page }) => cleanUp(page, created));
  test.use({ viewport: TALL });

  async function knownOnSave(page: Page, h: Header) {
    await page.route("**/api/vocabulary", async (route) => {
      if (route.request().method() === "POST" && route.request().postDataJSON().status === "known") h.knownWords++;
      await route.fallback();
    });
  }

  test("marking a word known flies Polly to the jar, which wobbles once as the count goes up", async ({ page }) => {
    const h = await stubHeader(page);
    await knownOnSave(page, h);
    const flights = await recordFlights(page);
    created = await createTextWith(page, (w) => `${w(0)} ${w(1)} ${w(2)}.`);
    await openReader(page, `/read/${created.id}`);
    await wordAt(page, 1).click();
    await expect(known(page)).toHaveText("10 known");
    await expect(jar(page)).toHaveAttribute("data-wobbles", "0");
    const callsBefore = h.calls;
    await page.getByRole("button", { name: "Known", exact: true }).click();
    const bee = page.getByTestId("polly-flight");
    await expect(bee).toBeVisible();
    await expect(bee.locator("svg")).toHaveAttribute("data-polly-size", "small");
    await expect(bee).toHaveCount(0);
    await expect(known(page)).toHaveText("11 known");
    await expect(jar(page)).toHaveAttribute("data-wobbles", "1");
    await expect.poll(() => h.calls).toBeGreaterThan(callsBefore);
    await page.waitForTimeout(500);
    await expect(known(page)).toHaveText("11 known");
    await expect(jar(page)).toHaveAttribute("data-wobbles", "1");
    expect(await flights()).toBe(1);
  });

  test("the K key flies Polly too", async ({ page }) => {
    const h = await stubHeader(page);
    await knownOnSave(page, h);
    const flights = await recordFlights(page);
    created = await createTextWith(page, (w) => `${w(0)} ${w(1)} ${w(2)}.`);
    await openReader(page, `/read/${created.id}`);
    await wordAt(page, 2).click();
    await expect(page.getByRole("button", { name: "Known", exact: true })).toBeVisible();
    await page.keyboard.press("k");
    await expect(known(page)).toHaveText("11 known");
    expect(await flights()).toBe(1);
  });

  test("turning a page that marks many words known sends no Polly, and the jar wobbles once", async ({ page }) => {
    const h = await stubHeader(page);
    await page.route("**/mark-known", async (route) => {
      h.knownWords += 40;
      await route.fallback();
    });
    const flights = await recordFlights(page);
    created = await createText(page);
    await openReader(page, `/read/${created.id}`);
    await expect(known(page)).toHaveText("10 known");
    await bottomPager(page).getByRole("button", { name: "Next page" }).click();
    await expect(known(page)).toHaveText("50 known");
    await expect(jar(page)).toHaveAttribute("data-wobbles", "1");
    expect(await flights()).toBe(0);
  });

  test("no Polly flies when the jar isn't on screen", async ({ page }) => {
    const h = await stubHeader(page);
    await knownOnSave(page, h);
    const flights = await recordFlights(page);
    created = await createTextWith(page, (w) => `${w(0)} ${w(1)} ${w(2)}.`);
    await openReader(page, `/read/${created.id}`);
    await jar(page).evaluate((el) => ((el as unknown as HTMLElement).style.display = "none"));
    await wordAt(page, 1).click();
    await page.getByRole("button", { name: "Known", exact: true }).click();
    await expect(known(page)).toHaveText("11 known");
    expect(await flights()).toBe(0);
  });

  test("with reduce motion on, no Polly flies and the jar stays still, but the count goes up", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const h = await stubHeader(page);
    await knownOnSave(page, h);
    const flights = await recordFlights(page);
    created = await createTextWith(page, (w) => `${w(0)} ${w(1)} ${w(2)}.`);
    await openReader(page, `/read/${created.id}`);
    await wordAt(page, 1).click();
    await page.getByRole("button", { name: "Known", exact: true }).click();
    await expect(known(page)).toHaveText("11 known");
    expect(await flights()).toBe(0);
    expect(await jar(page).evaluate((el) => getComputedStyle(el).animationName)).toBe("none");
  });
});
