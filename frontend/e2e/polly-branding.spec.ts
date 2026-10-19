import { expect, test, type Locator, type Page } from "@playwright/test";
import { cleanUp, createTextWith, openReader, wordAt, type Created } from "./reader-helpers";
import { map, openInFrench } from "./vocab-map-helpers";

const HOUR = 3600;
const known = (page: Page) => page.getByRole("banner").getByTestId("known-words");
const jar = (page: Page) => page.getByRole("banner").getByTestId("honey-jar");

function rgb(colour: string): [number, number, number] {
  const [r, g, b] = colour.match(/\d+(\.\d+)?/g)!.map(Number);
  return [r, g, b];
}

function hue(colour: string): number {
  const [r, g, b] = rgb(colour).map((c) => c / 255);
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

function luminance(colour: string): number {
  const [r, g, b] = rgb(colour).map((c) => (c / 255 <= 0.03928 ? c / 255 / 12.92 : ((c / 255 + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

async function expectHoney(element: Locator, property: "backgroundColor" | "fill" = "backgroundColor") {
  const colour = await element.evaluate((el, p) => getComputedStyle(el)[p], property);
  expect(hue(colour), colour).toBeGreaterThanOrEqual(30);
  expect(hue(colour), colour).toBeLessThanOrEqual(50);
}

async function stubHeader(page: Page, knownWords: { value: number }) {
  await page.route("**/api/dashboard/header*", (route) =>
    route.fulfill({ json: { current: 1, best: 1, activeToday: true, secondsLeftToday: HOUR, knownWords: knownWords.value } }));
}

test("the tab shows the hive mark", async ({ page }) => {
  await page.goto("/library");
  const href = await page.locator('link[rel="icon"]').first().getAttribute("href");
  expect(href).toMatch(/^\/icon\.svg/);
  const res = await page.request.get(href!);
  expect(res.headers()["content-type"]).toContain("image/svg+xml");
  expect(await res.text()).toContain("<polygon");
  await expect(page.locator('link[href^="/favicon.ico"]')).toHaveCount(0);
});

test("the top bar shows Polly just before the brand name", async ({ page }) => {
  await page.goto("/library");
  const home = page.getByRole("banner").getByRole("link", { name: "Polygossa home" });
  const polly = home.getByRole("img", { name: "Polly the bee" });
  await expect(polly).toBeVisible();
  const gap = await polly.evaluate((svg) => {
    const text = [...svg.parentElement!.childNodes].find((n) => n.nodeType === Node.TEXT_NODE && n.textContent!.trim())!;
    const range = document.createRange();
    range.selectNodeContents(text);
    return range.getBoundingClientRect().left - svg.getBoundingClientRect().right;
  });
  expect(gap).toBeGreaterThanOrEqual(0);
  expect(gap).toBeLessThan(16);
});

test("the Known badge on the Words list is honey", async ({ page }) => {
  await page.goto("/vocabulary");
  const me = await (await page.request.get("/api/me")).json();
  const term = `miel${Date.now()}`;
  const res = await page.request.post("/api/vocabulary", { data: { language: me.targetLanguage ?? "es", term, status: "known" } });
  expect(res.ok(), await res.text()).toBe(true);
  const { id } = await res.json();
  try {
    await page.goto("/vocabulary?status=known");
    const row = page.locator("li").filter({ hasText: term });
    await expectHoney(row.getByRole("combobox", { name: "Status" }));
  } finally {
    await page.request.delete(`/api/vocabulary/${id}`);
  }
});

test.describe("in the reader", () => {
  let created: Created | null = null;
  test.afterEach(async ({ page }) => cleanUp(page, created));

  test("the Known button in the word popup is honey once picked", async ({ page }) => {
    created = await createTextWith(page, (w) => `${w(0)} ${w(1)}.`);
    await openReader(page, `/read/${created.id}`);
    await wordAt(page, 0).click();
    const knownButton = page.getByRole("button", { name: "Known", exact: true });
    await knownButton.click();
    await expect(knownButton).toHaveClass(/bg-known/);
    await expectHoney(knownButton);
  });
});

test("the vocabulary map's key shows known as deep honey and learning paler", async ({ page }) => {
  await openInFrench(page);
  const swatch = (name: string) => map(page).getByTestId("map-legend").locator("span").filter({ hasText: name }).locator("i");
  await expectHoney(swatch("Known"));
  const colour = (name: string) => swatch(name).evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(luminance(await colour("Known"))).toBeLessThan(luminance(await colour("Learning")));
});

test("a honey jar sits just before the count, inside its link, which reads as before", async ({ page }) => {
  await stubHeader(page, { value: 1234 });
  await page.goto("/library");
  await expect(known(page)).toHaveText("1,234 known");
  await expect(known(page)).toHaveAccessibleName("1,234 known words (all forms)");
  await expect(known(page)).toHaveAttribute("href", "/vocabulary");
  await expect(known(page).getByTestId("honey-jar")).toBeVisible();
  await expect(jar(page)).toHaveAttribute("aria-hidden", "true");
  const [jarBox, countBox] = [(await jar(page).boundingBox())!, (await known(page).getByText("1,234", { exact: true }).boundingBox())!];
  expect(jarBox.x + jarBox.width).toBeLessThanOrEqual(countBox.x + 1);
  expect(countBox.x - (jarBox.x + jarBox.width)).toBeLessThan(10);
  expect(Math.abs(jarBox.y + jarBox.height / 2 - (countBox.y + countBox.height / 2))).toBeLessThan(4);
  await expect(jar(page)).toHaveAttribute("data-wobbles", "0");
});

test("clicking the honey jar opens the Words list", async ({ page }) => {
  await stubHeader(page, { value: 5 });
  await page.goto("/library");
  await jar(page).click();
  await page.waitForURL("**/vocabulary");
});

test("the jar wobbles once when the known count goes up", async ({ page }) => {
  const count = { value: 10 };
  await stubHeader(page, count);
  await page.goto("/library");
  await expect(known(page)).toHaveText("10 known");
  count.value = 11;
  await page.getByRole("navigation", { name: "Section" }).getByRole("link", { name: "Explore" }).click();
  await expect(known(page)).toHaveText("11 known");
  await expect(jar(page)).toHaveAttribute("data-wobbles", "1");
  expect(await jar(page).evaluate((el) => getComputedStyle(el).animationName)).toBe("jar-wobble");
  expect(await jar(page).evaluate((el) => getComputedStyle(el).animationIterationCount)).toBe("1");
});

test("with reduce motion on, the count changes and the jar stays still", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const count = { value: 10 };
  await stubHeader(page, count);
  await page.goto("/library");
  await expect(known(page)).toHaveText("10 known");
  count.value = 11;
  await page.getByRole("navigation", { name: "Section" }).getByRole("link", { name: "Explore" }).click();
  await expect(known(page)).toHaveText("11 known");
  expect(await jar(page).evaluate((el) => getComputedStyle(el).animationName)).toBe("none");
});

async function emptyWords(page: Page) {
  await page.route("**/api/vocabulary?*", (route) =>
    route.request().method() === "GET" ? route.fulfill({ json: { items: [], total: 0, page: 0, size: 50 } }) : route.continue());
}

test("an empty list shows Polly above the unchanged message, hidden from screen readers", async ({ page }) => {
  await emptyWords(page);
  await page.goto("/vocabulary");
  const empty = page.getByTestId("empty").filter({ hasText: "No words here yet" });
  await expect(empty).toContainText("Words you click while reading appear here.");
  const polly = empty.locator('svg[data-polly="curious"]');
  await expect(polly).toBeVisible();
  await expect(polly).toHaveAttribute("aria-hidden", "true");
  await expect(empty.getByRole("img")).toHaveCount(0);
  const [pollyBox, titleBox] = [(await polly.boundingBox())!, (await empty.getByText("No words here yet").boundingBox())!];
  expect(pollyBox.y + pollyBox.height).toBeLessThanOrEqual(titleBox.y);
});

async function nothingDue(page: Page) {
  await page.route("**/api/review/queue*", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/review/stats*", (route) => route.fulfill({
    json: { dueWords: 0, reviewedToday: 3, dailyGoal: 20, goalMet: false, streak: 1, history: [], wordsInAnki: 0 },
  }));
}

test("finishing review shows Polly cheering", async ({ page }) => {
  await nothingDue(page);
  await page.goto("/review");
  const empty = page.getByTestId("empty").filter({ hasText: "All caught up!" });
  await expect(empty.locator('svg[data-polly="cheering"]')).toBeVisible();
  await expect(empty.locator('svg[data-polly="sleepy"]')).toHaveCount(0);
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 360, height: 640 } });

  test("Polly stays small and the buttons stay on screen", async ({ page }) => {
    await nothingDue(page);
    await page.goto("/review");
    const empty = page.getByTestId("empty").filter({ hasText: "All caught up!" });
    const polly = empty.locator('svg[data-polly="cheering"]');
    await expect(polly).toBeVisible();
    expect((await polly.boundingBox())!.height).toBeLessThanOrEqual(96);
    for (const button of [empty.getByRole("button", { name: "Practise ahead" }), empty.getByRole("link", { name: "Read something new" })]) {
      await button.scrollIntoViewIfNeeded();
      const box = (await button.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(360);
    }
  });
});
