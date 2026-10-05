import { expect, test, type Locator, type Page } from "@playwright/test";

// A one-line segmented-control button is ~34px tall (text-sm + py-1.5); a wrapped label makes it ~52px.
const MAX_ONE_LINE_HEIGHT = 40;
const DESKTOP = { width: 1280, height: 800 };
const MOBILE = { width: 375, height: 800 };

const kindTabs = (page: Page) => page.getByRole("group", { name: "Show" });

async function box(locator: Locator) {
  const b = await locator.boundingBox();
  if (!b) throw new Error("element is not visible");
  return b;
}

async function expectOneLineButtons(group: Locator, labels: string[]) {
  await expect(group.getByRole("button")).toHaveText(labels.map((l) => new RegExp(`^${l}$`, "i")));
  for (const button of await group.getByRole("button").all()) {
    expect((await box(button)).height, `"${await button.textContent()}" height`).toBeLessThanOrEqual(MAX_ONE_LINE_HEIGHT);
  }
}

// The Library's Mine / Saved moved into the header's sub-tabs and All / Texts / Videos into the Filters panel
// (library-filters.spec.ts); the same one-line and equal-width checks follow them there.
const librarySections = (page: Page) => page.getByRole("navigation", { name: "Section" });
const filtersPanel = (page: Page) => page.getByRole("dialog", { name: "Filters" });

async function openFilters(page: Page) {
  await page.goto("/library");
  await page.getByRole("region", { name: "Filter library" }).getByRole("button", { name: /^Filters/ }).click();
  await expect(filtersPanel(page)).toBeVisible();
}

async function expectOneLineLinks(group: Locator, labels: string[]) {
  await expect(group.getByRole("link")).toHaveText(labels);
  for (const link of await group.getByRole("link").all()) {
    expect((await box(link)).height, `"${await link.textContent()}" height`).toBeLessThanOrEqual(MAX_ONE_LINE_HEIGHT);
  }
}

test.describe("Library page, desktop", () => {
  test.use({ viewport: DESKTOP });

  test("Mine / Saved and All / Texts / Videos are one line high", async ({ page }) => {
    await openFilters(page);
    await expectOneLineLinks(librarySections(page), ["Mine", "Saved", "Explore", "Playlists"]);
    await expectOneLineButtons(kindTabs(page), ["All", "Texts", "Videos"]);
  });

  test("All / Texts / Videos keeps its own height when the panel is taller", async ({ page }) => {
    await openFilters(page);
    await filtersPanel(page).evaluate((el) => { (el as HTMLElement).style.height = "420px"; });
    await expectOneLineButtons(kindTabs(page), ["All", "Texts", "Videos"]);
  });
});

test.describe("Library page, mobile", () => {
  test.use({ viewport: MOBILE });

  test("All / Texts / Videos spans the sheet, buttons share it equally and stay one line", async ({ page }) => {
    await openFilters(page);
    await expectOneLineLinks(librarySections(page), ["Mine", "Saved", "Explore", "Playlists"]);
    const kinds = kindTabs(page);
    await expectOneLineButtons(kinds, ["All", "Texts", "Videos"]);
    expect((await box(kinds)).width).toBeGreaterThan(MOBILE.width * 0.8);
    const widths = await Promise.all((await kinds.getByRole("button").all()).map(async (b) => (await box(b)).width));
    expect(Math.max(...widths) - Math.min(...widths)).toBeLessThanOrEqual(1);
  });
});

test.describe("other pages with segmented controls", () => {
  test.use({ viewport: DESKTOP });

  test("Explore's All / Texts / Videos is one line high", async ({ page }) => {
    await page.goto("/community");
    await expectOneLineButtons(kindTabs(page), ["All", "Texts", "Videos"]);
  });

  test("Vocabulary's Words / Sentences is one line high", async ({ page }) => {
    await page.goto("/vocabulary");
    await expectOneLineButtons(page.getByRole("group", { name: "Vocabulary section" }), ["Words", "Sentences"]);
  });
});
