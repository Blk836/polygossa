import { expect, test, type Page, type Route } from "@playwright/test";

// docs/acceptance/instant-tabs.feature: a tab click switches at once, and a tab already seen shows its last content
// while it refreshes.

let ownText: { id: number; title: string } | null = null;

async function createText(page: Page) {
  const me = await (await page.request.get("/api/me")).json();
  const title = `Instant tabs ${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const res = await page.request.post("/api/texts", {
    data: { title, language: me.targetLanguage ?? "fr", content: "Le chat dort sur le canapé.", isPublic: false, category: "other" },
  });
  expect(res.ok(), await res.text()).toBe(true);
  ownText = { id: (await res.json()).id, title };
  return ownText;
}

test.afterEach(async ({ page }) => {
  if (ownText) await page.request.delete(`/api/texts/${ownText.id}`);
  ownText = null;
});

/** Holds the matching requests until `release()` is called, so the test can look at the page in between. */
async function hold(page: Page, matches: (url: URL, route: Route) => boolean) {
  let release!: () => void;
  const released = new Promise<void>((resolve) => (release = resolve));
  await page.route("**/*", async (route) => {
    if (!matches(new URL(route.request().url()), route)) return route.fallback();
    await released;
    await route.fallback();
  });
  return release;
}

const tab = (page: Page, name: string) => page.getByRole("link", { name, exact: true });

async function openLibrary(page: Page, title: string) {
  await page.goto("/library");
  await expect(page.getByText(title)).toBeVisible();
}

async function goToExplore(page: Page) {
  await tab(page, "Explore").click();
  await expect(page.getByRole("heading", { name: "Explore" })).toBeVisible();
}

test("a click switches to the new tab at once, with an outline until the page arrives", async ({ page }) => {
  await page.goto("/community");
  await expect(page.getByRole("heading", { name: "Explore" })).toBeVisible();
  await page.waitForLoadState("networkidle"); // the tabs' outlines are prefetched by now
  const release = await hold(page, (url, route) => url.pathname === "/library" && !!route.request().headers()["rsc"]);

  await tab(page, "My library").click();
  await expect(page).toHaveURL(/\/library$/, { timeout: 2000 });
  await expect(page.getByTestId("page-loading")).toBeVisible();

  release();
  await expect(page.getByRole("heading", { name: "My library" })).toBeVisible();
  await expect(page.getByTestId("page-loading")).toHaveCount(0);
});

test("a tab already seen shows its last content at once while it refreshes", async ({ page }) => {
  await page.goto("/library");
  const { title } = await createText(page);
  await openLibrary(page, title);
  await goToExplore(page);
  const release = await hold(page, (url) => url.pathname === "/api/texts");

  await tab(page, "My library").click();
  await expect(page.getByText(title)).toBeVisible({ timeout: 2000 });
  await expect(page.locator("main").getByTestId("spinner")).toHaveCount(0);
  release();
});

test("the refresh brings a remembered tab up to date", async ({ page }) => {
  await page.goto("/library");
  const { id, title } = await createText(page);
  await openLibrary(page, title);
  await goToExplore(page);
  expect((await page.request.delete(`/api/texts/${id}`)).ok()).toBe(true);
  ownText = null;

  await tab(page, "My library").click();
  await expect(page.getByRole("heading", { name: "My library" })).toBeVisible();
  await expect(page.getByText(title)).toHaveCount(0);
});

test("a change made on a page is kept for the next visit", async ({ page }) => {
  await page.goto("/library");
  const { title } = await createText(page);
  await openLibrary(page, title);
  page.once("dialog", (d) => void d.accept());
  await page.getByTestId("card-grid").locator("article").filter({ hasText: title }).getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText(title)).toHaveCount(0);
  ownText = null;
  await goToExplore(page);
  const release = await hold(page, (url) => url.pathname === "/api/texts");

  await tab(page, "My library").click();
  await expect(page.getByRole("heading", { name: "My library" })).toBeVisible();
  await expect(page.getByText(title)).toHaveCount(0);
  release();
});

test("a failed refresh keeps the last content and says so", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Progress" })).toBeVisible();
  await tab(page, "Forum").click();
  await expect(page.getByRole("heading", { name: "Forum" })).toBeVisible();
  await page.route("**/api/dashboard?**", (route) =>
    route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ code: "error", message: "Progress is down" }) }),
  );

  await tab(page, "Progress").click();
  await expect(page.getByText("Progress is down")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Progress" })).toBeVisible();
});

test("a reload shows nothing remembered", async ({ page }) => {
  await page.goto("/library");
  const { title } = await createText(page);
  await openLibrary(page, title);
  const release = await hold(page, (url) => url.pathname === "/api/texts");

  await page.reload();
  await expect(page.getByRole("heading", { name: "My library" })).toBeVisible();
  await expect(page.locator("main").getByTestId("spinner")).toBeVisible();
  await expect(page.getByText(title)).toHaveCount(0);
  release();
});
