import { expect, test, type Page } from "@playwright/test";

// The vocabulary map on Progress (docs/acceptance/vocabulary-map.feature). The shared test user has no target language,
// so each test picks French in the top bar with the switch answered in the browser (never saved), and saves the map
// words it needs through the API, deleting them afterwards. Tests run in parallel on that one user, so each test saves
// different words and deletes only its own.

/** The French words this test saved, from the map or the API: deleted after it. */
const touched: string[] = [];

async function clearWords(page: Page) {
  for (const term of touched.splice(0)) {
    await page.request.delete(`/api/vocabulary/by-term?language=fr&term=${encodeURIComponent(term)}`);
  }
}

/** Opens Progress with French picked in the top bar, answered in the browser so the test user keeps no language. */
async function openInFrench(page: Page, path = "/dashboard") {
  await page.goto(path);
  const me = await (await page.request.get("/api/me")).json();
  await page.route("**/api/me", (route) => {
    if (route.request().method() !== "PATCH") return route.continue();
    const { targetLanguage } = route.request().postDataJSON();
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ...me, targetLanguage }) });
  });
  await pickLanguage(page, "Français");
  await expect(map(page).getByTestId("map-overall")).toBeVisible();
}

async function pickLanguage(page: Page, native: string) {
  await page.getByRole("banner").getByRole("button", { name: /Change language/ }).click();
  await page.getByRole("menu", { name: "Language" }).getByRole("menuitemradio", { name: new RegExp(native) }).click();
}

const map = (page: Page) => page.getByTestId("vocab-map");
const tile = (page: Page, name: string) => map(page).getByRole("button", { name: new RegExp(`^${name}:`) });
const wordTile = (page: Page, term: string) => map(page).getByTestId("map-word").filter({ hasText: new RegExp(`^${term}$`) });

async function save(page: Page, term: string, status: string) {
  touched.push(term);
  const res = await page.request.post("/api/vocabulary", { data: { language: "fr", term, status } });
  expect(res.ok(), await res.text()).toBe(true);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/library"); // signs in (auto-login) for page.request
});

test.afterEach(async ({ page }) => {
  await clearWords(page);
  try {
    await page.evaluate(() => window.localStorage.removeItem("lector_map_band"));
  } catch {
    // The page may already be gone.
  }
});

test("without a target language the map asks me to pick one", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(map(page)).toContainText("Pick the language you're learning");
});

test("the map sits above the period comparison and shows every region", async ({ page }) => {
  await openInFrench(page);
  await expect(map(page).getByTestId("map-tile")).toHaveCount(14);
  await expect(map(page).getByTestId("beyond-core")).toBeVisible();
  const mapBox = (await map(page).boundingBox())!;
  const periodBox = (await page.getByRole("region", { name: "Last week" }).boundingBox())!;
  expect(mapBox.y).toBeLessThan(periodBox.y);
  await expect(page.getByRole("region", { name: "Skill levels" })).toBeVisible();
  await expect(tile(page, "Food & Drink").getByTestId("tile-count")).toHaveText(/^\d+ \/ \d+$/);
});

test("I zoom into a region and an area, and back out with the breadcrumb, Back and a reload", async ({ page }) => {
  await openInFrench(page);
  await tile(page, "Food & Drink").click();
  await expect(map(page).getByTestId("map-tile")).toHaveCount(6);
  await tile(page, "Fruit & vegetables").click();
  await expect(map(page).getByTestId("map-breadcrumb")).toHaveText("Map›Food & Drink›Fruit & vegetables");
  await expect(wordTile(page, "pomme")).toBeVisible();
  expect(new URL(page.url()).searchParams.get("map")).toBe("food/fruit-veg");

  await page.reload();
  await pickLanguage(page, "Français");
  await expect(wordTile(page, "pomme")).toBeVisible();

  await page.goBack();
  await expect(map(page).getByTestId("map-breadcrumb")).toHaveText("Map›Food & Drink");
  await map(page).getByRole("button", { name: "Map", exact: true }).click();
  await expect(map(page).getByTestId("map-tile")).toHaveCount(14);
});

test("a word counts in the form I know it, and tapping it shows its meaning", async ({ page }) => {
  await save(page, "mangé", "known");
  await openInFrench(page, "/dashboard?map=food/cooking");
  await expect(wordTile(page, "manger")).toHaveAttribute("data-status", "known");
  await wordTile(page, "manger").click();
  const panel = map(page).getByTestId("map-word-panel");
  await expect(panel.getByTestId("map-word-meaning")).toHaveText("to eat");
  await expect(panel.getByTestId("map-word-status")).toHaveText("Known");
  await expect(panel.getByRole("button", { name: "I know this" })).toHaveCount(0);
});

test("I start learning a word from the map, then mark one known", async ({ page }) => {
  touched.push("poire", "pomme");
  await openInFrench(page, "/dashboard?map=food");
  const area = tile(page, "Fruit & vegetables");
  await expect(area.getByTestId("tile-learning")).toHaveCount(0);
  await area.click();

  await wordTile(page, "poire").click();
  const panel = map(page).getByTestId("map-word-panel");
  await expect(panel).toContainText("pear");
  await panel.getByRole("button", { name: "Start learning" }).click();
  await expect(wordTile(page, "poire")).toHaveAttribute("data-status", "learning");
  const saved = await (await page.request.get("/api/vocabulary?language=fr&status=learning&q=poire")).json();
  expect(saved.items.map((e: { term: string }) => e.term)).toContain("poire");

  await wordTile(page, "pomme").click();
  await panel.getByRole("button", { name: "I know this" }).click();
  await expect(wordTile(page, "pomme")).toHaveAttribute("data-status", "known");

  await map(page).getByRole("button", { name: "Food & Drink" }).click();
  await expect(tile(page, "Fruit & vegetables").getByTestId("tile-learning")).toHaveText("1 learning");
});

test("the free plan's limit stops Start learning with the reader's upgrade message", async ({ page }) => {
  await page.route("**/api/vocabulary", (route) => {
    if (route.request().method() !== "POST") return route.continue();
    return route.fulfill({ status: 402, contentType: "application/json",
      body: JSON.stringify({ code: "upgrade_required", message: "You've reached the free plan's 20 saved words." }) });
  });
  await openInFrench(page, "/dashboard?map=food/fruit-veg");
  await wordTile(page, "banane").click();
  await map(page).getByRole("button", { name: "Start learning" }).click();
  await expect(map(page)).toContainText("You've reached the free plan's 20 saved words.");
  await expect(wordTile(page, "banane")).toHaveAttribute("data-status", "new");
});

test("a native language the list doesn't cover gets the reader's lookup", async ({ page }) => {
  await page.route("**/api/vocab-map?**", async (route) => {
    const body = await (await route.fetch()).json();
    body.meaningLanguage = "pl";
    for (const region of body.regions) for (const area of region.areas) for (const w of area.words) w.meaning = null;
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
  await page.route("**/api/dictionary?**", (route) => route.fulfill({ status: 200, contentType: "application/json",
    body: JSON.stringify({ term: "pomme", language: "fr", meanings: ["jabłko"], meaningLanguage: "pl", source: "machine" }) }));
  await openInFrench(page, "/dashboard?map=food/fruit-veg");
  await wordTile(page, "pomme").click();
  await expect(map(page).getByTestId("map-word-meaning")).toHaveText("jabłko");
});

test("the band picker changes what counts, and is remembered", async ({ page }) => {
  await openInFrench(page);
  const overall = map(page).getByTestId("map-overall");
  await expect(map(page).getByLabel("Bands counted")).toHaveValue("A1");
  const a1 = await overall.textContent();
  await expect(tile(page, "Food & Drink").getByTestId("tile-next")).toHaveText(/^\+\d+ at A2$/);

  await map(page).getByLabel("Bands counted").selectOption("B1");
  await expect(overall).not.toHaveText(a1!);
  await expect(map(page)).toContainText("B2 words coming soon.");
  await expect(tile(page, "Food & Drink").getByTestId("tile-next")).toHaveCount(0);

  await page.reload();
  await pickLanguage(page, "Français");
  await expect(map(page).getByLabel("Bands counted")).toHaveValue("B1");
});

test("a language without a list says the map is coming soon", async ({ page }) => {
  await openInFrench(page);
  await pickLanguage(page, "Español");
  await expect(map(page)).toContainText("The vocabulary map is coming soon for Spanish.");
  await expect(page.getByRole("region", { name: "Skill levels" })).toBeVisible();
});

test("Beyond the core opens my known words", async ({ page }) => {
  await openInFrench(page);
  await map(page).getByTestId("beyond-core").click();
  await expect(page).toHaveURL(/\/vocabulary\?status=known$/);
  await expect(page.getByLabel("Status")).toHaveValue("known");
});

test("the map fits a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" }); // measure the tiles at full size, not mid-zoom
  await openInFrench(page, "/dashboard?map=food/fruit-veg");
  await expect(wordTile(page, "pomme")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBe(0);
  const box = (await wordTile(page, "pomme").boundingBox())!;
  expect(box.height).toBeGreaterThanOrEqual(44);
});
