import { expect, test, type Locator, type Page } from "@playwright/test";

const DESKTOP = { width: 1280, height: 900 };
const MOBILE = { width: 375, height: 800 };

const picker = (page: Page) => page.getByRole("radiogroup", { name: "Card layout" });
const option = (page: Page, name: "Cards" | "Compact" | "List") => picker(page).getByRole("radio", { name });
const grid = (page: Page) => page.getByTestId("card-grid");

async function box(locator: Locator) {
  const b = await locator.boundingBox();
  if (!b) throw new Error("element is not visible");
  return b;
}

const columns = (locator: Locator) =>
  locator.evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").filter((c) => c !== "none").length);

let ownText: { id: number; title: string } | null = null;

async function createOwnText(page: Page) {
  await page.goto("/library");
  const me = await (await page.request.get("/api/me")).json();
  const title = `Layout check ${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const res = await page.request.post("/api/texts", {
    data: { title, language: me.targetLanguage ?? "fr", content: "Le chat dort sur le canapé. Il fait beau.", isPublic: true, category: "other" },
  });
  expect(res.ok(), await res.text()).toBe(true);
  ownText = { id: (await res.json()).id, title };
  return ownText;
}

test.afterEach(async ({ page }) => {
  if (ownText) await page.request.delete(`/api/texts/${ownText.id}`);
  ownText = null;
});

const ownCard = (page: Page) => grid(page).getByRole("article").filter({ hasText: ownText!.title });

test.describe("Library, desktop", () => {
  test.use({ viewport: DESKTOP });

  test("cards is the default and keeps the original 4-column grid", async ({ page }) => {
    await createOwnText(page);
    await page.reload();
    await expect(option(page, "Cards")).toHaveAttribute("aria-checked", "true");
    await expect(option(page, "Compact")).toHaveAttribute("aria-checked", "false");
    await expect(option(page, "List")).toHaveAttribute("aria-checked", "false");
    expect(await columns(grid(page))).toBe(4);
  });

  test("compact packs more, smaller cards per row", async ({ page }) => {
    await createOwnText(page);
    await page.reload();
    const regular = await box(ownCard(page));

    await option(page, "Compact").click();
    await expect(option(page, "Compact")).toHaveAttribute("aria-checked", "true");
    await expect.poll(() => columns(grid(page))).toBe(6);
    const compact = await box(ownCard(page));
    expect(compact.width).toBeLessThan(regular.width * 0.8);
    expect(compact.height).toBeLessThan(regular.height);
  });

  test("list shows one row per item, thumbnail beside the title", async ({ page }) => {
    await createOwnText(page);
    await page.reload();
    await option(page, "List").click();
    await expect(option(page, "List")).toHaveAttribute("aria-checked", "true");

    const g = await box(grid(page));
    const row = ownCard(page);
    await expect.poll(async () => (await box(row)).width).toBeGreaterThan(g.width - 2);
    const r = await box(row);
    expect(r.height).toBeLessThan(140);
    const cover = await box(row.locator("a").first());
    const title = await box(row.getByRole("link", { name: ownText!.title }));
    expect(cover.x + cover.width).toBeLessThanOrEqual(title.x);
  });

  test("owner actions stay available in every layout", async ({ page }) => {
    await createOwnText(page);
    await page.reload();
    for (const name of ["Cards", "Compact", "List"] as const) {
      await option(page, name).click();
      await expect(ownCard(page).getByRole("button", { name: "Delete" }), name).toBeVisible();
      await expect(ownCard(page).getByRole("combobox"), name).toBeVisible();
    }
  });

  test("the choice is remembered across reloads and shared with Explore; cards clears it", async ({ page, context }) => {
    await page.goto("/library");
    await option(page, "List").click();
    await page.reload();
    await expect(option(page, "List")).toHaveAttribute("aria-checked", "true");
    expect((await context.cookies()).find((c) => c.name === "lector_card_layout")?.value).toBe("list");

    await page.goto("/community");
    await expect(option(page, "List")).toHaveAttribute("aria-checked", "true");

    await option(page, "Cards").click();
    await expect.poll(async () => (await context.cookies()).find((c) => c.name === "lector_card_layout")).toBeUndefined();
    await page.reload();
    await expect(option(page, "Cards")).toHaveAttribute("aria-checked", "true");
  });

  test("an unknown saved value falls back to cards", async ({ page, context }) => {
    await context.addCookies([{ name: "lector_card_layout", value: "tiles", url: test.info().project.use.baseURL }]);
    await page.goto("/library");
    await expect(option(page, "Cards")).toHaveAttribute("aria-checked", "true");
  });

  test("the layout picker is a labelled radio group usable from the keyboard", async ({ page }) => {
    await page.goto("/library");
    await option(page, "Compact").focus();
    await page.keyboard.press("Enter");
    await expect(option(page, "Compact")).toHaveAttribute("aria-checked", "true");
  });
});

test.describe("Explore, desktop", () => {
  test.use({ viewport: DESKTOP });

  test("shelves show narrower cards in compact and list layouts", async ({ page }) => {
    await createOwnText(page);
    await page.goto("/community");
    const shelfCard = () => page.locator("section article").first();
    const regular = await box(shelfCard());
    await option(page, "Compact").click();
    await expect.poll(async () => (await box(shelfCard())).width).toBeLessThan(regular.width * 0.8);
    await option(page, "List").click();
    await expect(page.locator("section article").first()).toBeVisible();
    expect((await box(shelfCard())).width).toBeLessThan(regular.width * 0.8);
  });

  test("a category or search grid follows the layout", async ({ page }) => {
    await createOwnText(page);
    await page.goto("/community");
    await option(page, "Compact").click();
    await page.getByRole("searchbox", { name: "Search titles" }).fill(ownText!.title);
    await page.keyboard.press("Enter");
    await expect.poll(() => columns(grid(page))).toBe(6);
    await option(page, "List").click();
    await expect(grid(page)).toHaveCSS("display", "flex");
  });
});

test.describe("mobile", () => {
  test.use({ viewport: MOBILE });

  test("list rows fit the screen with actions reachable and no sideways scroll", async ({ page }) => {
    await createOwnText(page);
    await page.reload();
    await expect(picker(page)).toBeVisible();
    await option(page, "List").click();
    await expect(ownCard(page).getByRole("button", { name: "Delete" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(MOBILE.width);
  });

  test("compact shows two cards per row", async ({ page }) => {
    await createOwnText(page);
    await page.reload();
    await option(page, "Compact").click();
    await expect.poll(() => columns(grid(page))).toBe(2);
  });
});
