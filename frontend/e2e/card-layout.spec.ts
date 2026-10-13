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

let shelfTexts: number[] = [];

async function createShelfTexts(page: Page, count: number) {
  await page.goto("/library");
  const me = await (await page.request.get("/api/me")).json();
  const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  for (let i = 0; i < count; i++) {
    const res = await page.request.post("/api/texts", {
      data: { title: `Shelf row ${i} ${stamp}`, language: me.targetLanguage ?? "fr", content: "Le train part à midi. Il fait beau.", isPublic: true, category: "travel" },
    });
    expect(res.ok(), await res.text()).toBe(true);
    shelfTexts.push((await res.json()).id);
  }
}

test.afterEach(async ({ page }) => {
  if (ownText) await page.request.delete(`/api/texts/${ownText.id}`);
  ownText = null;
  for (const id of shelfTexts) await page.request.delete(`/api/texts/${id}`);
  shelfTexts = [];
});

const shelfTextCards = (page: Page) => page.locator("main section article:has([data-cover])");

async function coverBesideTitle(card: Locator) {
  const cover = await box(card.locator("[data-cover]"));
  const title = await box(card.getByRole("link").first());
  return cover.x + cover.width <= title.x + 1;
}

async function coverAboveTitle(card: Locator) {
  const cover = await box(card.locator("[data-cover]"));
  const title = await box(card.getByRole("link").first());
  return cover.y + cover.height <= title.y + 1;
}

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

  test("shelves show narrower cards in compact, and rows in list", async ({ page }) => {
    await createOwnText(page);
    await page.goto("/community");
    const shelfCard = () => page.locator("section article").first();
    const regular = await box(shelfCard());
    await option(page, "Compact").click();
    await expect.poll(async () => (await box(shelfCard())).width).toBeLessThan(regular.width * 0.8);
    await option(page, "List").click();
    await expect.poll(() => coverBesideTitle(shelfTextCards(page).first())).toBe(true);
    expect((await box(shelfTextCards(page).first())).height).toBeLessThan(regular.height * 0.6);
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

test.describe("Explore shelves, desktop", () => {
  test.use({ viewport: DESKTOP });

  test("compact and list look different on the shelves: narrow cards, then rows", async ({ page }) => {
    await createShelfTexts(page, 1);
    await page.goto("/community");
    const first = () => shelfTextCards(page).first();
    await option(page, "Compact").click();
    await expect.poll(() => coverAboveTitle(first())).toBe(true);
    const compact = await box(first());

    await option(page, "List").click();
    await expect.poll(() => coverBesideTitle(first())).toBe(true);
    const row = await box(first());
    expect(row.width).toBeGreaterThan(compact.width * 1.5);
    expect(row.height).toBeLessThan(compact.height);

    await option(page, "Compact").click();
    await expect.poll(() => coverAboveTitle(first())).toBe(true);
  });

  test("in list, every shelf's text cards are rows, with their actions", async ({ page }) => {
    await createShelfTexts(page, 1);
    await page.goto("/community");
    await option(page, "List").click();
    const cards = shelfTextCards(page);
    await expect(cards.first()).toBeVisible();
    const count = await cards.count();
    for (let i = 0; i < count; i++) {
      const card = cards.nth(i);
      await card.scrollIntoViewIfNeeded();
      expect(await coverBesideTitle(card), `card ${i}`).toBe(true);
      await expect(card.getByRole("button", { name: "Add to playlist" }), `card ${i}`).toBeVisible();
      await expect(card.getByRole("button", { name: /^(Like|Unlike)$/ }), `card ${i}`).toBeVisible();
    }
  });

  test("in list, a shelf stacks its rows three high in columns that scroll sideways", async ({ page }) => {
    await createShelfTexts(page, 4);
    await page.goto("/community");
    await option(page, "List").click();
    const shelf = page.getByRole("region", { name: "Travel" });
    const rows = shelf.getByRole("article");
    await expect(rows.nth(3)).toBeAttached();
    await expect.poll(() => coverBesideTitle(rows.first())).toBe(true);
    const [a, b, c, d] = await Promise.all([0, 1, 2, 3].map((i) => box(rows.nth(i))));
    expect(Math.round(b.x)).toBe(Math.round(a.x));
    expect(Math.round(c.x)).toBe(Math.round(a.x));
    expect(b.y).toBeGreaterThan(a.y);
    expect(c.y).toBeGreaterThan(b.y);
    expect(d.x).toBeGreaterThan(a.x + a.width - 1);
    expect(Math.round(d.y)).toBe(Math.round(a.y));
  });

  test("while the shelves load in list, their outline shows rows", async ({ page, context }) => {
    await context.addCookies([{ name: "lector_card_layout", value: "list", url: test.info().project.use.baseURL }]);
    let release!: () => void;
    const released = new Promise<void>((resolve) => (release = resolve));
    await page.route("**/api/library/shelves*", async (route) => {
      await released;
      await route.fallback();
    });
    await page.goto("/community");
    const bone = page.locator('main [data-skeleton="shelf"][data-layout="list"]').first().locator(":scope > div").nth(1).locator(":scope > div").first();
    await expect(bone).toBeVisible();
    const cover = await box(bone.locator(":scope > *").first());
    const lines = await box(bone.locator(":scope > *").nth(1));
    expect(cover.x + cover.width).toBeLessThanOrEqual(lines.x + 1);
    release();
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

  test("Explore's list rows fit the screen, with no sideways page scroll", async ({ page }) => {
    await createShelfTexts(page, 1);
    await page.goto("/community");
    await option(page, "List").click();
    const first = shelfTextCards(page).first();
    await expect.poll(() => coverBesideTitle(first)).toBe(true);
    const row = await box(first);
    expect(row.x).toBeGreaterThanOrEqual(0);
    expect(row.x + row.width).toBeLessThanOrEqual(MOBILE.width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(MOBILE.width);
  });

  test("compact shows two cards per row", async ({ page }) => {
    await createOwnText(page);
    await page.reload();
    await option(page, "Compact").click();
    await expect.poll(() => columns(grid(page))).toBe(2);
  });
});
