import { expect, test, type Page, type Route } from "@playwright/test";
import { cleanUp, createText, type Created } from "./reader-helpers";

// My library (docs/acceptance/library-two-tabs.feature): imports and saved items in one list. Its filters are
// Airbnb-style: category chips in one bar right above the cards, and everything else (texts or videos, imported or
// saved) behind a single "Filters" button with a count badge. Both list APIs are stubbed with the test's own text, so
// counts and empty states are exact.

let created: Created | null = null;

test.afterEach(async ({ page }) => {
  await cleanUp(page, created);
  created = null;
});

const bar = (page: Page) => page.getByRole("region", { name: "Filter library" });
const filtersButton = (page: Page) => bar(page).getByRole("button", { name: /^Filters/ });
const panel = (page: Page) => page.getByRole("dialog", { name: "Filters" });
const cards = (page: Page) => page.getByTestId("card-grid").getByRole("article");
const chips = (page: Page) => bar(page).getByRole("group", { name: "Category" });

/**
 * Stubs GET /api/texts (two of my texts, news and stories) and GET /api/library/bookmarks (`saved`, none by default),
 * each empty for "video". Returns the kinds asked for.
 */
async function stubLibrary(page: Page, { saved = 0 }: { saved?: number } = {}) {
  created = await createText(page, 30);
  const template = (await (await page.request.get(`/api/texts/${created.id}`)).json()).text;
  const items = [
    { ...template, id: created.id, title: `Filter news ${created.prefix}`, category: "news", mine: true },
    { ...template, id: created.id + 1_000_000, title: `Filter story ${created.prefix}`, category: "stories", mine: true },
  ];
  const bookmarks = Array.from({ length: saved }, (_, i) => ({
    ...template,
    id: created!.id + 2_000_000 + i,
    title: `Saved news ${i} ${created!.prefix}`,
    category: "news",
    mine: false,
    bookmarked: true,
    owner: { ...template.owner, id: -1, displayName: "Other learner" },
  }));
  const kinds: string[] = [];
  const answer = (list: object[]) => (route: Route) => {
    const kind = new URL(route.request().url()).searchParams.get("kind") ?? "all";
    kinds.push(kind);
    return route.fulfill({ json: kind === "video" ? [] : list });
  };
  await page.route(/\/api\/texts(\?|$)/, answer(items));
  await page.route(/\/api\/library\/bookmarks(\?|$)/, answer(bookmarks));
  return { kinds, bookmarks };
}

const sourceGroup = (page: Page) => panel(page).getByRole("group", { name: "Source" });

test.describe("My library", () => {
  test("is the second sub-tab, after Explore", async ({ page }) => {
    await page.goto("/library");
    const sections = page.getByRole("navigation", { name: "Section" });
    await expect(sections.getByRole("link")).toHaveText(["Explore", "My library"]);
    await expect(sections.locator("[aria-current=page]")).toHaveText("My library");
    await expect(page.getByRole("heading", { name: "My library", level: 1 })).toBeVisible();
  });

  test("lists my imports first, then saved items with their owner", async ({ page }) => {
    await stubLibrary(page, { saved: 1 });
    await page.goto("/library");
    await expect(cards(page)).toHaveCount(3);
    await expect(cards(page).nth(2)).toContainText("Saved news 0");
    await expect(cards(page).nth(2)).toContainText("Other learner");
    await expect(cards(page).nth(0)).not.toContainText("Other learner");
  });

  test("a text of mine that I also saved is listed once, as mine", async ({ page }) => {
    const { bookmarks } = await stubLibrary(page);
    bookmarks.push({ ...bookmarks[0], id: created!.id, title: `Filter news ${created!.prefix}`, mine: true } as never);
    await page.goto("/library");
    await expect(cards(page)).toHaveCount(2);
    await expect(cards(page).filter({ hasText: "Filter news" })).toHaveCount(1);
  });

  test("the Source filter shows imported or saved items, with a removable pill", async ({ page }) => {
    await stubLibrary(page, { saved: 1 });
    await page.goto("/library");
    await filtersButton(page).click();
    await expect(sourceGroup(page).getByRole("button")).toHaveText(["All", "Imported", "Saved"]);
    await sourceGroup(page).getByRole("button", { name: "Imported" }).click();
    await expect(cards(page)).toHaveCount(2);
    await expect(filtersButton(page)).toHaveAccessibleName("Filters, 1 active");
    await sourceGroup(page).getByRole("button", { name: "Saved" }).click();
    await expect(cards(page)).toHaveCount(1);
    await expect(cards(page)).toContainText("Saved news 0");
    await page.keyboard.press("Escape");
    await bar(page).getByRole("button", { name: "Remove filter: Saved" }).click();
    await expect(cards(page)).toHaveCount(3);
    await expect(filtersButton(page)).toHaveAccessibleName("Filters");
  });

  test("Source, type and category combine, and the badge counts both panel filters", async ({ page }) => {
    await stubLibrary(page, { saved: 1 });
    await page.goto("/library");
    await chips(page).getByRole("button", { name: "News & society" }).click();
    await expect(cards(page)).toHaveCount(2);
    await filtersButton(page).click();
    await sourceGroup(page).getByRole("button", { name: "Saved" }).click();
    await expect(cards(page)).toHaveCount(1);
    await panel(page).getByRole("group", { name: "Show" }).getByRole("button", { name: "Videos" }).click();
    await expect(filtersButton(page)).toHaveAccessibleName("Filters, 2 active");
    await page.keyboard.press("Escape");
    await expect(page.getByText("No saved videos in News & society")).toBeVisible();
  });

  test("nothing saved says so, with Clear filters", async ({ page }) => {
    await stubLibrary(page);
    await page.goto("/library");
    await filtersButton(page).click();
    await sourceGroup(page).getByRole("button", { name: "Saved" }).click();
    await page.keyboard.press("Escape");
    await expect(page.getByText(/^No saved .*texts or videos$/)).toBeVisible();
    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(cards(page)).toHaveCount(2);
  });

  test("saved cards have Unsave and no owner actions; mine have owner actions and no Unsave", async ({ page }) => {
    await stubLibrary(page, { saved: 1 });
    await page.goto("/library");
    const saved = cards(page).filter({ hasText: "Saved news 0" });
    const mine = cards(page).filter({ hasText: "Filter news" });
    await expect(saved.getByRole("button", { name: "Unsave" })).toBeVisible();
    await expect(saved.getByRole("button", { name: /^Add to playlist/ })).toBeVisible();
    await expect(saved.getByRole("button", { name: /delete/i })).toHaveCount(0);
    await expect(mine.getByRole("button", { name: "Unsave" })).toHaveCount(0);
  });

  test("Unsave removes the card at once", async ({ page }) => {
    const { bookmarks } = await stubLibrary(page, { saved: 1 });
    let deleted = "";
    await page.route(`**/api/library/${bookmarks[0].id}/bookmark`, (route) => {
      deleted = route.request().method();
      return route.fulfill({ status: 204 });
    });
    await page.goto("/library");
    await cards(page).filter({ hasText: "Saved news 0" }).getByRole("button", { name: "Unsave" }).click();
    await expect(cards(page)).toHaveCount(2);
    expect(deleted).toBe("DELETE");
  });

  test("a failed Unsave keeps the card and shows the error", async ({ page }) => {
    const { bookmarks } = await stubLibrary(page, { saved: 1 });
    await page.route(`**/api/library/${bookmarks[0].id}/bookmark`, (route) =>
      route.fulfill({ status: 500, json: { code: "error", message: "Couldn't unsave that" } }),
    );
    await page.goto("/library");
    await cards(page).filter({ hasText: "Saved news 0" }).getByRole("button", { name: "Unsave" }).click();
    await expect(page.getByText("Couldn't unsave that")).toBeVisible();
    await expect(cards(page)).toHaveCount(3);
  });

  test("when saved items fail to load, it shows the error, not an empty library", async ({ page }) => {
    await stubLibrary(page);
    await page.route(/\/api\/library\/bookmarks(\?|$)/, (route) => route.fulfill({ status: 500, json: { code: "error", message: "Bookmarks are down" } }));
    await page.goto("/library");
    await expect(page.getByText("Bookmarks are down")).toBeVisible();
    await expect(page.getByText(/yet$/)).toHaveCount(0);
  });

  test("the old Saved page lands on My library filtered to Saved", async ({ page }) => {
    await stubLibrary(page, { saved: 1 });
    await page.goto("/library/saved");
    await page.waitForURL("**/library?source=saved");
    await expect(bar(page).getByRole("button", { name: "Remove filter: Saved" })).toBeVisible();
    await expect(cards(page)).toHaveCount(1);
  });

  test("the free plan's count names imports only", async ({ page }) => {
    // The account arrives with the page (server-side), so the free plan is stubbed on the refresh that follows an
    // Unsave; the test account itself stays on its Classroom plan for the other tests.
    const { bookmarks } = await stubLibrary(page, { saved: 1 });
    await page.route(`**/api/library/${bookmarks[0].id}/bookmark`, (route) => route.fulfill({ status: 204 }));
    await page.route("**/api/me", async (route) => {
      const me = await (await route.fetch()).json();
      return route.fulfill({ json: { ...me, plan: { ...me.plan, usage: { ...me.plan.usage, texts: 3 }, limits: { ...me.plan.limits, texts: 5 } } } });
    });
    await page.goto("/library");
    await cards(page).filter({ hasText: "Saved news 0" }).getByRole("button", { name: "Unsave" }).click();
    await expect(page.getByText("3 of 5 imported texts and videos on the free plan (all languages). Saved items don't count.")).toBeVisible();
  });
});

test.describe("the filter bar", () => {
  test("holds the category chips and one Filters button, right above the cards", async ({ page }) => {
    await stubLibrary(page);
    await page.goto("/library");
    await expect(chips(page).getByRole("button")).toHaveText(["All", "Stories", "News & society"]); // the shelf order
    await expect(filtersButton(page)).toHaveAccessibleName("Filters");
    await expect(page.getByRole("group", { name: "Show" })).toHaveCount(0); // texts/videos live in the panel
    const barBox = (await bar(page).boundingBox())!;
    const gridBox = (await page.getByTestId("card-grid").boundingBox())!;
    expect(gridBox.y).toBeGreaterThan(barBox.y + barBox.height - 1);
    expect(gridBox.y - (barBox.y + barBox.height)).toBeLessThan(48);
  });

  test("a category chip filters the cards", async ({ page }) => {
    await stubLibrary(page);
    await page.goto("/library");
    await expect(cards(page)).toHaveCount(2);
    await chips(page).getByRole("button", { name: "Stories" }).click();
    await expect(cards(page)).toHaveCount(1);
    await expect(cards(page)).toContainText("Filter story");
    await expect(chips(page).getByRole("button", { name: "Stories" })).toHaveAttribute("aria-pressed", "true");
  });
});

test.describe("the Filters panel", () => {
  test("opens with Texts / Videos, applies at once and badges the button", async ({ page }) => {
    const { kinds } = await stubLibrary(page);
    await page.goto("/library");
    await filtersButton(page).click();
    await expect(filtersButton(page)).toHaveAttribute("aria-expanded", "true");
    const type = panel(page).getByRole("group", { name: "Show" });
    await expect(type.getByRole("button")).toHaveText(["All", "Texts", "Videos"]);
    await type.getByRole("button", { name: "Texts" }).click();
    await expect.poll(() => kinds.at(-1)).toBe("text");
    await expect(panel(page).getByRole("button", { name: "Show 2 items" })).toBeVisible();
    await expect(filtersButton(page)).toHaveAccessibleName("Filters, 1 active");
    await expect(filtersButton(page).getByTestId("filter-count")).toHaveText("1");
  });

  test("Show N items closes it, and the active filter stays visible as a removable pill", async ({ page }) => {
    const { kinds } = await stubLibrary(page);
    await page.goto("/library");
    await filtersButton(page).click();
    await panel(page).getByRole("group", { name: "Show" }).getByRole("button", { name: "Texts" }).click();
    await panel(page).getByRole("button", { name: "Show 2 items" }).click();
    await expect(panel(page)).toHaveCount(0);
    const pill = bar(page).getByRole("button", { name: "Remove filter: Texts" });
    await expect(pill).toBeVisible();
    await pill.click();
    await expect(pill).toHaveCount(0);
    await expect.poll(() => kinds.at(-1)).toBe("all");
    await expect(filtersButton(page)).toHaveAccessibleName("Filters");
  });

  test("Clear all resets the panel's filters and the category", async ({ page }) => {
    await stubLibrary(page);
    await page.goto("/library");
    await chips(page).getByRole("button", { name: "Stories" }).click();
    await filtersButton(page).click();
    await panel(page).getByRole("group", { name: "Show" }).getByRole("button", { name: "Texts" }).click();
    await panel(page).getByRole("button", { name: "Clear all" }).click();
    await expect(panel(page).getByRole("group", { name: "Show" }).getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "true");
    await expect(chips(page).getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "true");
    await expect(cards(page)).toHaveCount(2);
  });

  test("Escape and clicking outside close it, returning focus to the button", async ({ page }) => {
    await stubLibrary(page);
    await page.goto("/library");
    await filtersButton(page).click();
    await page.keyboard.press("Escape");
    await expect(panel(page)).toHaveCount(0);
    await expect(filtersButton(page)).toBeFocused();
    await filtersButton(page).click();
    await page.getByRole("heading", { name: "My library" }).click();
    await expect(panel(page)).toHaveCount(0);
  });

  test("filters that leave nothing say what emptied the list, with a way back", async ({ page }) => {
    await stubLibrary(page);
    await page.goto("/library");
    await chips(page).getByRole("button", { name: "Stories" }).click();
    await filtersButton(page).click();
    await panel(page).getByRole("group", { name: "Show" }).getByRole("button", { name: "Videos" }).click();
    await expect(panel(page).getByRole("button", { name: "Show 0 items" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByText(/^No .*videos in Stories$/)).toBeVisible();
    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(cards(page)).toHaveCount(2);
    await expect(filtersButton(page)).toHaveAccessibleName("Filters");
  });
});

test.describe("phones", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("the panel is a full-width sheet at the bottom and nothing scrolls sideways", async ({ page }) => {
    await stubLibrary(page);
    await page.goto("/library");
    await filtersButton(page).click();
    const box = (await panel(page).boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(389);
    expect(Math.round(box.y + box.height)).toBeGreaterThanOrEqual(843);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
