import { expect, test, type Locator, type Page } from "@playwright/test";
import { cleanUp, createText, createTextWith, openReader, wordAt, type Created } from "./reader-helpers";
import { answerBox, answerFor, handIn, holdSubmit, ok, proLearner, results, resultsOutline, startTest } from "./writing-helpers";

const polly = (scope: Locator | Page, mood: string) => scope.locator(`svg[data-polly="${mood}"]`);

async function nothingDue(page: Page) {
  await page.route("**/api/review/queue*", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/review/stats*", (route) => route.fulfill({
    json: { dueWords: 0, reviewedToday: 3, dailyGoal: 20, goalMet: false, streak: 1, history: [], wordsInAnki: 0 },
  }));
}

async function emptyWords(page: Page) {
  await page.route("**/api/vocabulary?*", (route) =>
    route.request().method() === "GET" ? route.fulfill({ json: { items: [], total: 0, page: 0, size: 50 } }) : route.continue());
}

test("her stripes are cut off at her outline, on every Polly on the page", async ({ page }) => {
  await nothingDue(page);
  await page.goto("/review");
  const all = page.locator("svg[data-polly]");
  await expect(all.first()).toBeVisible();
  expect(await all.count()).toBeGreaterThanOrEqual(2);
  for (const svg of await all.all()) {
    const check = await svg.evaluate((el) => {
      const stripes = el.querySelector("[data-part=stripes]")!;
      const id = /url\(#([^)]+)\)/.exec(stripes.getAttribute("clip-path") ?? "")?.[1];
      const clip = id ? el.ownerDocument.getElementById(id)?.querySelector("ellipse") : null;
      const body = el.querySelector("[data-part=body]")!;
      const attrs = (e: Element | null | undefined) => ["cx", "cy", "rx", "ry"].map((a) => e?.getAttribute(a)).join(",");
      return { clip: attrs(clip), body: attrs(body), outlineOnTop: !!(stripes.compareDocumentPosition(el.querySelector("[data-part=outline]")!) & Node.DOCUMENT_POSITION_FOLLOWING) };
    });
    expect(check.clip).toBe(check.body);
    expect(check.outlineOnTop).toBe(true);
  }
});

test("the top bar's logo is the small Polly, still named for screen readers", async ({ page }) => {
  await page.goto("/library");
  const logo = page.getByRole("banner").getByRole("img", { name: "Polly the bee" });
  await expect(logo).toBeVisible();
  await expect(logo).toHaveAttribute("data-polly-size", "small");
  for (const part of ["antenna", "cheek", "mouth"]) await expect(logo.locator(`[data-part=${part}]`)).toHaveCount(0);
  await expect(logo.locator("[data-part=eye]")).toHaveCount(2);
  await expect(logo.locator("[data-part=stripes] path")).toHaveCount(1);
});

test("an empty Words list shows a curious Polly holding a book", async ({ page }) => {
  await emptyWords(page);
  await page.goto("/vocabulary");
  const empty = page.getByTestId("empty").filter({ hasText: "No words here yet" });
  const p = polly(empty, "curious");
  await expect(p).toBeVisible();
  await expect(p).toHaveAttribute("data-polly-prop", "book");
  await expect(p.locator("[data-part=arm]")).toHaveCount(2);
});

test("all caught up in Review shows a cheering Polly holding flashcards", async ({ page }) => {
  await nothingDue(page);
  await page.goto("/review");
  const p = polly(page.getByTestId("empty").filter({ hasText: "All caught up!" }), "cheering");
  await expect(p).toHaveAttribute("data-polly-prop", "flashcards");
});

test("Explore filtered to videos with no results shows a curious Polly in headphones", async ({ page }) => {
  await page.route("**/api/library?*", (route) =>
    new URL(route.request().url()).searchParams.get("kind") === "video"
      ? route.fulfill({ json: { items: [], total: 0, page: 0, size: 24 } })
      : route.fallback());
  await page.goto("/community");
  await page.getByRole("group", { name: "Show" }).getByRole("button", { name: "Videos" }).click();
  const p = polly(page.getByTestId("empty").filter({ hasText: "Nothing matches" }), "curious");
  await expect(p).toHaveAttribute("data-polly-prop", "headphones");
});

test("a playlist that doesn't exist shows a sorry Polly", async ({ page }) => {
  await page.goto("/playlists/987654321");
  await expect(polly(page.getByTestId("empty").filter({ hasText: "Playlist not found" }), "sorry")).toBeVisible();
});

test("without a prop Polly has no arms", async ({ page }) => {
  await page.route("**/api/playlists*", (route) => (route.request().method() === "GET" ? route.fulfill({ json: [] }) : route.fallback()));
  await page.goto("/playlists");
  const p = polly(page.getByTestId("empty"), "curious");
  await expect(p).toBeVisible();
  await expect(p).not.toHaveAttribute("data-polly-prop");
  await expect(p.locator("[data-part=arm]")).toHaveCount(0);
});

test("a page that fails to load shows a sorry Polly, a way to try again, and the top bar", async ({ page }) => {
  await page.goto("/read/99999999999999999999999");
  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { name: "This page couldn't load" })).toBeVisible();
  await expect(main.getByText("Check your connection and try again.")).toBeVisible();
  await expect(polly(main, "sorry")).toBeVisible();
  await expect(main.getByRole("button", { name: "Try again" })).toBeVisible();
  await expect(page.getByRole("banner")).toBeVisible();
});

test("an address that isn't a page shows a sorry Polly and a link home", async ({ page }) => {
  await page.goto("/no-such-page-here");
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  await expect(polly(page, "sorry")).toBeVisible();
  await page.getByRole("link", { name: "Go home" }).click();
  await page.waitForURL((url) => url.pathname !== "/no-such-page-here");
});

test.describe("thinking", () => {
  let created: Created | null = null;
  test.afterEach(async ({ page }) => cleanUp(page, created));

  test("a small thinking Polly shows while a word's meaning loads", async ({ page }) => {
    created = await createTextWith(page, (w) => `${w(0)} ${w(1)}.`);
    let release = () => {};
    const held = new Promise<void>((resolve) => (release = resolve));
    await page.route("**/api/dictionary?*", async (route) => {
      await held;
      await route.fallback();
    });
    await openReader(page, `/read/${created.id}`);
    await wordAt(page, 0).click();
    const loading = page.getByRole("status", { name: "Loading" });
    await expect(polly(loading, "thinking")).toBeVisible();
    await expect(loading).toHaveAttribute("aria-label", "Loading");
    release();
    await expect(page.getByTestId("meanings")).toBeVisible();
    await expect(loading).toHaveCount(0);
  });

  test("finishing a lesson shows a cheering Polly instead of the party emoji", async ({ page }) => {
    created = await createText(page);
    await openReader(page, `/read/${created.id}?page=4`);
    await page.getByRole("button", { name: "Finish lesson" }).click();
    const summary = page.locator("[data-finish=summary]");
    await expect(summary.getByText("Lesson complete", { exact: true })).toBeVisible();
    await expect(summary).not.toContainText("🎉");
    await expect(polly(summary, "cheering")).toBeVisible();
  });
});

test("a thinking Polly with a pencil sits above the results' outline while writing is graded", async ({ browser }) => {
  const { context, page } = await proLearner(browser);
  const t = await startTest(page);
  const answer = answerFor(t);
  const submit = holdSubmit(page, [ok(answer)], t);
  await page.goto("/writing");
  await answerBox(page).fill(answer);
  await handIn(page).click();
  const grading = page.getByTestId("grading-polly");
  await expect(grading).toContainText("Grading your writing…");
  const p = polly(grading, "thinking");
  await expect(p).toHaveAttribute("data-polly-prop", "pencil");
  expect((await p.boundingBox())!.y).toBeLessThan((await resultsOutline(page).boundingBox())!.y);
  submit.release();
  await expect(results(page)).toBeVisible();
  await expect(grading).toHaveCount(0);
  await context.close();
});
