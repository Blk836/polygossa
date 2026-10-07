import { expect, test, type Page } from "@playwright/test";

// The header's numbers: known words (LingQ-style) and the streak flame, lit once today is done, burning down towards
// midnight while a streak is at risk, out with no streak. GET /api/dashboard/header is stubbed so each state is exact;
// the "real" tests use the backend.

const HOUR = 3600;
const flame = (page: Page) => page.getByRole("banner").getByTestId("streak-flame");

async function stubStreak(page: Page, streak: { current: number; activeToday: boolean; secondsLeftToday: number; knownWords?: number }) {
  const calls = { count: 0 };
  await page.route("**/api/dashboard/header*", (route) => {
    calls.count++;
    return route.fulfill({ json: { best: Math.max(streak.current, 1), knownWords: 0, ...streak } });
  });
  return calls;
}

test("a streak done for today burns fully and links to Progress", async ({ page }) => {
  await stubStreak(page, { current: 4, activeToday: true, secondsLeftToday: 2 * HOUR });
  await page.goto("/library");
  await expect(flame(page)).toHaveAttribute("data-state", "lit");
  await expect(flame(page)).toHaveAttribute("data-fuel", "1");
  await expect(flame(page)).toHaveAccessibleName("4-day streak — today's done");
  await expect(flame(page)).toHaveText("4");
  await flame(page).click();
  await page.waitForURL("**/dashboard");
});

test("a streak at risk burns down with the time left today", async ({ page }) => {
  await stubStreak(page, { current: 4, activeToday: false, secondsLeftToday: 6 * HOUR });
  await page.goto("/library");
  await expect(flame(page)).toHaveAttribute("data-state", "fading");
  await expect(flame(page)).toHaveAttribute("data-fuel", "0.25");
  await expect(flame(page)).toHaveAccessibleName("4-day streak — practise in the next 6h 0m to keep it");
});

test("the flame keeps burning down while the page stays open", async ({ page }) => {
  await page.clock.install();
  await stubStreak(page, { current: 2, activeToday: false, secondsLeftToday: 6 * HOUR });
  await page.goto("/library");
  await expect(flame(page)).toHaveAccessibleName(/next 6h 0m/);
  await page.clock.runFor(3 * HOUR * 1000);
  await expect(flame(page)).toHaveAccessibleName(/next 3h 0m/);
  await expect(flame(page)).toHaveAttribute("data-fuel", "0.125");
});

test("at midnight the flame asks for the new day's streak", async ({ page }) => {
  await page.clock.install();
  const calls = await stubStreak(page, { current: 2, activeToday: false, secondsLeftToday: 120 });
  await page.goto("/library");
  await expect(flame(page)).toHaveAttribute("data-state", "fading");
  const before = calls.count;
  await page.clock.runFor(3 * 60 * 1000);
  await expect.poll(() => calls.count).toBeGreaterThan(before);
});

test("with no streak the flame is out", async ({ page }) => {
  await stubStreak(page, { current: 0, activeToday: false, secondsLeftToday: 6 * HOUR });
  await page.goto("/library");
  await expect(flame(page)).toHaveAttribute("data-state", "out");
  await expect(flame(page)).toHaveAccessibleName("No streak yet — practise today to start one");
  await expect(flame(page)).toHaveText("0");
});

test("a failing streak request leaves the flame off without errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/api/dashboard/header*", (route) => route.fulfill({ status: 500, json: { code: "error", message: "boom" } }));
  await page.goto("/library");
  await expect(page.getByRole("button", { name: "Account" })).toBeVisible();
  await expect(flame(page)).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("saving a word lights the real flame for today", async ({ page }) => {
  await page.goto("/library");
  const res = await page.request.post("/api/vocabulary", { data: { language: "es", term: `llama${Date.now()}` } });
  expect(res.ok(), await res.text()).toBe(true);
  const id = (await res.json()).id;
  try {
    await page.goto("/dashboard");
    await expect(flame(page)).toHaveAttribute("data-state", "lit");
    const shown = Number(await flame(page).textContent());
    await expect(page.getByTestId("streak-count")).toHaveText(String(shown));
  } finally {
    await page.request.delete(`/api/vocabulary/${id}`);
  }
});

const known = (page: Page) => page.getByRole("banner").getByTestId("known-words");

test("known words show in the header as \"<count> known\", with thousands separated", async ({ page }) => {
  await stubStreak(page, { current: 1, activeToday: true, secondsLeftToday: HOUR, knownWords: 1234 });
  await page.goto("/library");
  await expect(known(page)).toHaveText("1,234 known");
  await expect(known(page)).toHaveAccessibleName("1,234 known words");
  await expect(known(page)).toHaveAttribute("title", "1,234 known words");
  await expect(known(page)).toHaveAttribute("href", "/vocabulary");
  await expect(known(page).locator("svg")).toHaveCount(0);
});

test("the count is bold and the word \"known\" is muted", async ({ page }) => {
  await stubStreak(page, { current: 1, activeToday: true, secondsLeftToday: HOUR, knownWords: 0 });
  await page.goto("/library");
  await expect(known(page)).toHaveText("0 known");
  const look = (text: string) => known(page).getByText(text, { exact: true }).evaluate((e) => {
    const s = getComputedStyle(e);
    return { weight: Number(s.fontWeight), color: s.color };
  });
  const count = await look("0");
  const word = await look("known");
  expect(count.weight).toBeGreaterThanOrEqual(600);
  expect(word.weight).toBeLessThan(600);
  const muted = await page.evaluate(() => {
    const probe = document.createElement("span");
    probe.className = "text-muted";
    document.body.append(probe);
    const color = getComputedStyle(probe).color;
    probe.remove();
    return color;
  });
  expect(word.color).toBe(muted);
  expect(count.color).not.toBe(muted);
});

test("known words are asked for in the language picked in the top bar", async ({ page }) => {
  const asked: string[] = [];
  await page.route("**/api/dashboard/header*", (route) => {
    asked.push(new URL(route.request().url()).searchParams.get("language") ?? "");
    return route.fulfill({ json: { current: 0, best: 0, activeToday: false, secondsLeftToday: HOUR, knownWords: 7 } });
  });
  await page.goto("/library");
  const me = await (await page.request.get("/api/me")).json();
  await expect(known(page)).toHaveText("7 known");
  expect(asked.at(-1)).toBe(me.targetLanguage ?? "");
});

test("marking a word known raises the real count after moving page", async ({ page }) => {
  await page.goto("/library");
  const me = await (await page.request.get("/api/me")).json();
  const language = me.targetLanguage ?? "es";
  const before = Number((await known(page).textContent())!.replace(/\D/g, ""));
  const res = await page.request.post("/api/vocabulary", { data: { language, term: `sabido${Date.now()}`, status: "known" } });
  expect(res.ok(), await res.text()).toBe(true);
  const id = (await res.json()).id;
  try {
    await page.getByRole("navigation", { name: "Section" }).getByRole("link", { name: "Explore" }).click();
    await expect(known(page)).toHaveText(`${(before + 1).toLocaleString("en-US")} known`);
  } finally {
    await page.request.delete(`/api/vocabulary/${id}`);
  }
});
