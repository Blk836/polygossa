import { expect, test, type Page } from "@playwright/test";
import { cleanUp, createText, type Created } from "./reader-helpers";

// The Library's filters, Airbnb-style: Mine / Saved are header sub-tabs, category chips sit in one bar right above the
// cards, and everything else (texts or videos) is behind a single "Filters" button with a count badge. The list API
// is stubbed with the test's own text in two categories, so counts and empty states are exact.

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

/** Stubs GET /api/texts: two texts (news, stories) for "all" and "text", none for "video". Returns the kinds asked for. */
async function stubLibrary(page: Page) {
  created = await createText(page, 30);
  const template = (await (await page.request.get(`/api/texts/${created.id}`)).json()).text;
  const items = [
    { ...template, id: created.id, title: `Filter news ${created.prefix}`, category: "news" },
    { ...template, id: created.id + 1_000_000, title: `Filter story ${created.prefix}`, category: "stories" },
  ];
  const kinds: string[] = [];
  await page.route(/\/api\/texts(\?|$)/, (route) => {
    const kind = new URL(route.request().url()).searchParams.get("kind") ?? "all";
    kinds.push(kind);
    return route.fulfill({ json: kind === "video" ? [] : items });
  });
  return kinds;
}

test.describe("sections", () => {
  test("Mine and Saved are sub-tabs, not a toggle on the page", async ({ page }) => {
    await page.goto("/library");
    const sections = page.getByRole("navigation", { name: "Section" });
    await expect(sections.getByRole("link")).toHaveText(["Mine", "Saved", "Explore", "Playlists"]);
    await expect(sections.locator("[aria-current=page]")).toHaveText("Mine");
    await expect(page.getByRole("group", { name: "Library section" })).toHaveCount(0);
    await sections.getByRole("link", { name: "Saved" }).click();
    await page.waitForURL("**/library/saved");
    await expect(sections.locator("[aria-current=page]")).toHaveText("Saved");
    await expect(page.getByRole("heading", { name: "Saved" })).toBeVisible();
  });

  test("Saved lists bookmarks", async ({ page }) => {
    const bookmarks = page.waitForRequest((r) => new URL(r.url()).pathname === "/api/library/bookmarks");
    await page.goto("/library/saved");
    await bookmarks;
    await expect(page.getByTestId("card-grid").or(page.getByText(/^No saved/))).toBeVisible();
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
    const kinds = await stubLibrary(page);
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
    const kinds = await stubLibrary(page);
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
    await page.getByRole("heading", { name: "Library" }).click();
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
