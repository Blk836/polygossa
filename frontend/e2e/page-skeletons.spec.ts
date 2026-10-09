import { expect, test, type Locator, type Page } from "@playwright/test";

// docs/acceptance/page-skeletons.feature: each page loads with an outline shaped like it, and fills in without moving.

/** Holds the navigation request for `path` (not its prefetch) until `release()`, so the outline can be looked at. */
async function holdPage(page: Page, path: string | RegExp) {
  let release!: () => void;
  const released = new Promise<void>((resolve) => (release = resolve));
  await page.route("**/*", async (route) => {
    const req = route.request();
    const { pathname } = new URL(req.url());
    const matches = typeof path === "string" ? pathname === path : path.test(pathname);
    const headers = req.headers();
    if (!matches || !headers["rsc"] || headers["next-router-prefetch"]) return route.fallback();
    await released;
    await route.fallback();
  });
  return release;
}

/** Holds API requests whose path matches, e.g. a page's own data. */
async function holdApi(page: Page, path: RegExp) {
  let release!: () => void;
  const released = new Promise<void>((resolve) => (release = resolve));
  await page.route("**/api/**", async (route) => {
    if (!path.test(new URL(route.request().url()).pathname)) return route.fallback();
    await released;
    await route.fallback();
  });
  return release;
}

const tab = (page: Page, name: string | RegExp) => page.getByRole("link", { name, exact: typeof name === "string" });
const outline = (page: Page) => page.getByTestId("page-loading");
const visibleSpinners = (page: Page) => page.locator("main [data-testid=spinner]:visible");

async function top(locator: Locator) {
  const box = await locator.boundingBox();
  expect(box, "element has a box").not.toBeNull();
  return { x: Math.round(box!.x), y: Math.round(box!.y) };
}

async function openAccountItem(page: Page, name: string) {
  await page.getByRole("button", { name: "Account" }).click();
  await page.waitForLoadState("networkidle"); // the menu's links are prefetched
  await page.getByRole("menu", { name: "Account" }).getByRole("menuitem", { name }).click();
}

type Destination = {
  page: string;
  title: string;
  path: string;
  from: string;
  open: (page: Page) => Promise<void>;
  /** The outline's grey shapes for this page's content. */
  parts: string[];
  /** A section the real page shows at once: it must appear where the outline had it. */
  section?: { part: string; real: (page: Page) => Locator };
};

const DESTINATIONS: Destination[] = [
  {
    page: "Explore", title: "Explore", path: "/community", from: "/library", open: (p) => tab(p, "Explore").click(),
    parts: ["toolbar", "chips", "shelf"],
    section: { part: "toolbar", real: (p) => p.locator("[data-tour=explore-search]") },
  },
  {
    page: "My library", title: "My library", path: "/library", from: "/community", open: (p) => tab(p, "My library").click(),
    parts: ["actions", "filters", "cards"],
    section: { part: "filters", real: (p) => p.getByRole("region", { name: "Filter library" }) },
  },
  {
    page: "Review", title: "Review", path: "/review", from: "/community", open: (p) => tab(p, /^Practice/).click(),
    parts: ["goal", "flashcard"],
  },
  {
    page: "Words", title: "Vocabulary", path: "/vocabulary", from: "/review", open: (p) => tab(p, "Words").click(),
    parts: ["actions", "switch", "filters", "rows"],
    section: { part: "switch", real: (p) => p.getByRole("group", { name: "Vocabulary section" }) },
  },
  {
    page: "Write", title: "Writing", path: "/writing", from: "/review", open: (p) => tab(p, "Write").click(),
    parts: ["start", "rows"],
  },
  {
    page: "Progress", title: "Progress", path: "/dashboard", from: "/community", open: (p) => tab(p, "Progress").click(),
    parts: ["picker", "streak", "goal", "milestone", "wide"],
  },
  {
    page: "Forum", title: "Forum", path: "/forum", from: "/community", open: (p) => tab(p, "Forum").click(),
    parts: ["actions", "tabs", "rows"],
    section: { part: "tabs", real: (p) => p.getByRole("navigation", { name: "Forum categories" }) },
  },
  {
    page: "Playlists", title: "Playlists", path: "/playlists", from: "/library",
    open: (p) => p.getByRole("main").getByRole("link", { name: "Playlists", exact: true }).click(),
    parts: ["cards"],
  },
  {
    page: "Classes", title: "Classes", path: "/classes", from: "/community", open: (p) => openAccountItem(p, "Classes"),
    parts: ["forms", "rows"],
  },
  {
    page: "Import", title: "Import", path: "/import", from: "/library",
    open: (p) => p.getByRole("main").getByRole("link", { name: "+ Import" }).click(),
    parts: ["form"],
    section: { part: "form", real: (p) => p.locator("[data-tour=import-source]") },
  },
];

for (const d of DESTINATIONS) {
  test(`${d.page} shows an outline shaped like it, and fills in without moving`, async ({ page }) => {
    await page.goto(d.from);
    await expect(page.locator("h1")).toBeVisible();
    await page.waitForLoadState("networkidle");
    const release = await holdPage(page, d.path);

    await d.open(page);
    await expect(outline(page)).toBeVisible();
    await expect(outline(page)).toHaveAttribute("aria-label", `Loading ${d.page}`);
    const title = outline(page).getByText(d.title, { exact: true });
    await expect(title).toBeVisible();
    for (const part of d.parts) await expect(outline(page).locator(`[data-skeleton="${part}"]`).first(), part).toBeVisible();
    const titleAt = await top(title);
    const sectionAt = d.section && (await top(outline(page).locator(`[data-skeleton="${d.section.part}"]`)));

    release();
    const heading = page.getByRole("heading", { level: 1, name: d.title, exact: true });
    await expect(heading).toBeVisible();
    await expect(outline(page)).toHaveCount(0);
    expect(await top(heading)).toEqual(titleAt);
    if (d.section) expect(await top(d.section.real(page))).toEqual(sectionAt);
  });
}

for (const layout of ["list", "compact", "cards"] as const) {
  test(`card outlines follow the ${layout} layout`, async ({ page, context }) => {
    const { hostname } = new URL(test.info().project.use.baseURL!);
    await context.addCookies([{ name: "lector_card_layout", value: layout === "cards" ? "" : layout, domain: hostname, path: "/" }]);
    await page.goto("/community");
    await page.waitForLoadState("networkidle");
    const release = await holdPage(page, "/library");

    await tab(page, "My library").click();
    await expect(outline(page).locator('[data-skeleton="cards"]')).toHaveAttribute("data-layout", layout);
    release();
  });
}

test("opening a lesson shows the reader's outline", async ({ page }) => {
  await page.goto("/library");
  const me = await (await page.request.get("/api/me")).json();
  const title = `Skeleton lesson ${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const res = await page.request.post("/api/texts", {
    data: { title, language: me.targetLanguage ?? "fr", content: "Le chat dort sur le canapé.", isPublic: false, category: "other" },
  });
  expect(res.ok(), await res.text()).toBe(true);
  const { id } = await res.json();
  try {
    await page.goto("/library");
    await expect(page.getByRole("link", { name: title })).toBeVisible();
    await page.waitForLoadState("networkidle");
    const release = await holdPage(page, `/read/${id}`);

    await page.getByRole("link", { name: title }).click();
    await expect(outline(page)).toHaveAttribute("aria-label", "Loading lesson");
    await expect(outline(page).getByText("← Library")).toBeVisible();
    await expect(outline(page).locator('[data-skeleton="text"]')).toBeVisible();
    await expect(outline(page).getByText("My library")).toHaveCount(0);
    release();
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  } finally {
    await page.request.delete(`/api/texts/${id}`);
  }
});

test("pages inside Settings keep the Settings title and tabs while a tab loads", async ({ page }) => {
  await page.goto("/settings");
  const heading = page.getByRole("heading", { level: 1, name: "Settings" });
  await expect(heading).toBeVisible();
  await page.waitForLoadState("networkidle");
  const headingAt = await top(heading);
  const release = await holdPage(page, "/settings/appearance");

  await tab(page, "Appearance").click();
  await expect(outline(page)).toHaveAttribute("aria-label", "Loading Appearance");
  await expect(heading).toBeVisible();
  expect(await top(heading)).toEqual(headingAt);
  await expect(page.getByRole("link", { name: "Profile", exact: true })).toBeVisible();
  release();
  await expect(outline(page)).toHaveCount(0);
});

test("a page without its own outline gets a neutral one, with no other page's title", async ({ page }) => {
  await page.goto("/community");
  await expect(page.locator("h1")).toBeVisible();
  await page.waitForLoadState("networkidle");
  const release = await holdPage(page, "/admin");

  await openAccountItem(page, "Admin");
  await expect(outline(page)).toHaveAttribute("aria-label", "Loading page");
  await expect(outline(page)).toHaveText("");
  release();
});

test("with reduced motion the outline doesn't pulse", async ({ page }) => {
  for (const motion of ["no-preference", "reduce"] as const) {
    await page.emulateMedia({ reducedMotion: motion });
    const release = await holdApi(page, /^\/api\/dashboard$/);
    await page.goto("/dashboard");
    const bone = outline(page).locator("[data-bone]").first();
    await expect(bone).toBeVisible();
    const animation = await bone.evaluate((el) => getComputedStyle(el).animationName);
    expect(animation, motion).toBe(motion === "reduce" ? "none" : "pulse");
    release();
    await page.unrouteAll({ behavior: "ignoreErrors" });
  }
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("the outline has the phone layout, with no sideways scrolling", async ({ page }) => {
    await page.goto("/library");
    await expect(page.locator("h1")).toBeVisible();
    await page.waitForLoadState("networkidle");
    const release = await holdPage(page, "/community");

    await tab(page, "Explore").click();
    await expect(outline(page)).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    release();
  });
});

// While a page's own data loads it keeps the outline's shapes, not a spinner (a full load: nothing remembered).
const IN_PAGE: { page: string; path: string; api: RegExp; part: string }[] = [
  { page: "Progress", path: "/dashboard", api: /^\/api\/dashboard$/, part: "streak" },
  { page: "Explore", path: "/community", api: /^\/api\/library\/shelves$/, part: "shelf" },
  { page: "My library", path: "/library", api: /^\/api\/texts$/, part: "cards" },
  { page: "Forum", path: "/forum", api: /^\/api\/forum\/threads$/, part: "rows" },
  { page: "Words", path: "/vocabulary", api: /^\/api\/vocabulary$/, part: "rows" },
  { page: "Review", path: "/review", api: /^\/api\/review\/queue$/, part: "flashcard" },
];

for (const p of IN_PAGE) {
  test(`${p.page} keeps the outline, not a spinner, while its content loads`, async ({ page }) => {
    const release = await holdApi(page, p.api);
    await page.goto(p.path);
    await expect(page.locator(`main [data-skeleton="${p.part}"]`).first()).toBeVisible();
    await expect(visibleSpinners(page)).toHaveCount(0);
    release();
    await expect(page.locator(`main [data-skeleton="${p.part}"]`)).toHaveCount(0);
  });
}
