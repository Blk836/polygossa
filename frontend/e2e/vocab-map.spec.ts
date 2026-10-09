import { expect, test } from "@playwright/test";
import {
  cleanUpAfterEach,
  island,
  label,
  map,
  openInFrench,
  pickLanguage,
  province,
  restingZoom,
  save,
  touched,
  wordDot,
  world,
} from "./vocab-map-helpers";

// The vocabulary map on Progress (docs/acceptance/vocabulary-map.feature): the island world, its counts, bands and
// words. The camera's tests are in vocab-map-camera.spec.ts; the helpers and the shared test user's rules in
// vocab-map-helpers.ts.

cleanUpAfterEach();

test("without a target language the map asks me to pick one", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(map(page)).toContainText("Pick the language you're learning");
  await expect(world(page)).toHaveCount(0);
});

test("the map is an island world above the period comparison, with an island per region", async ({ page }) => {
  await openInFrench(page);
  await expect(map(page).getByTestId("map-island")).toHaveCount(14);
  await expect(map(page).getByTestId("island-label")).toHaveCount(14);
  await expect(map(page).getByTestId("beyond-core")).toBeVisible();
  await expect(island(page, "Food & Drink")).toHaveAttribute("aria-label", /^Food & Drink: \d+ of \d+ known$/);
  await expect(label(page, "island-label", "food").getByTestId("tile-count")).toHaveText(/^\d+ \/ \d+$/);
  // Bigger regions are bigger islands: Core words holds the most words, Communication the fewest.
  const core = (await island(page, "Core words").boundingBox())!;
  const communication = (await island(page, "Communication").boundingBox())!;
  expect(core.width).toBeGreaterThan(communication.width * 1.5);
  // A dot per word, from far away too: at least the A1 and A2 words.
  expect(await map(page).locator("circle").count()).toBeGreaterThan(1000);

  const mapBox = (await map(page).boundingBox())!;
  const periodBox = (await page.getByRole("region", { name: "Last week" }).boundingBox())!;
  expect(mapBox.y).toBeLessThan(periodBox.y);
  await expect(page.getByRole("region", { name: "Skill levels" })).toBeVisible();
});

test("tapping glides into an island and a province, and the breadcrumb, Back and a reload keep up", async ({ page }) => {
  await openInFrench(page);
  const out = await restingZoom(page);
  await island(page, "Food & Drink").click();
  await expect(map(page).getByTestId("map-province")).toHaveCount(6);
  await expect(label(page, "province-label", "fruit-veg")).toContainText("Fruit & vegetables");
  await expect(label(page, "island-label", "food")).toHaveCount(0);
  const atIsland = await restingZoom(page);
  expect(atIsland).toBeGreaterThan(out * 2);

  await province(page, "Fruit & vegetables").click();
  await expect(map(page).getByTestId("map-breadcrumb")).toHaveText("Map›Food & Drink›Fruit & vegetables");
  await expect(map(page).locator("text.map-word-label", { hasText: /^pomme$/ })).toBeVisible();
  expect(await restingZoom(page)).toBeGreaterThan(atIsland);
  expect(new URL(page.url()).searchParams.get("map")).toBe("food/fruit-veg");

  await page.reload();
  await pickLanguage(page, "Français");
  await expect(wordDot(page, "pomme")).toBeVisible();

  await page.goBack();
  await expect(map(page).getByTestId("map-breadcrumb")).toHaveText("Map›Food & Drink");
  await expect(map(page).getByTestId("map-word")).toHaveCount(0);
  await map(page).getByRole("button", { name: "Zoom out" }).click();
  await expect(map(page).getByTestId("map-breadcrumb")).toHaveText("Map");
  await expect(map(page).getByTestId("island-label")).toHaveCount(14);
  expect(await restingZoom(page)).toBeCloseTo(out, 3);

  await island(page, "Home").click();
  await map(page).getByRole("button", { name: "Map", exact: true }).click();
  await expect(map(page).getByTestId("map-province")).toHaveCount(0);
});

test("a word counts in the form I know it, and tapping it shows its meaning", async ({ page }) => {
  await save(page, "mangé", "known");
  await openInFrench(page, "/dashboard?map=food/cooking");
  await expect(wordDot(page, "manger")).toHaveAttribute("data-status", "known");
  await wordDot(page, "manger").click();
  const panel = map(page).getByTestId("map-word-panel");
  await expect(panel.getByTestId("map-word-meaning")).toHaveText("to eat");
  await expect(panel.getByTestId("map-word-status")).toHaveText("Known");
  await expect(panel.getByRole("button", { name: "I know this" })).toHaveCount(0);
});

test("I start learning a word from the map, then mark one known", async ({ page }) => {
  touched.push("poire", "pomme");
  await openInFrench(page, "/dashboard?map=food");
  await expect(label(page, "province-label", "fruit-veg").getByTestId("tile-learning")).toHaveCount(0);
  await province(page, "Fruit & vegetables").click();

  await wordDot(page, "poire").click();
  const panel = map(page).getByTestId("map-word-panel");
  await expect(panel).toContainText("pear");
  await panel.getByRole("button", { name: "Start learning" }).click();
  await expect(wordDot(page, "poire")).toHaveAttribute("data-status", "learning");
  const saved = await (await page.request.get("/api/vocabulary?language=fr&status=learning&q=poire")).json();
  expect(saved.items.map((e: { term: string }) => e.term)).toContain("poire");

  await wordDot(page, "pomme").click();
  await panel.getByRole("button", { name: "I know this" }).click();
  await expect(wordDot(page, "pomme")).toHaveAttribute("data-status", "known");

  await map(page).getByTestId("map-breadcrumb").getByRole("button", { name: "Food & Drink" }).click();
  await expect(label(page, "province-label", "fruit-veg").getByTestId("tile-learning")).toHaveText("1 learning");
});

test("the free plan's limit stops Start learning with the reader's upgrade message", async ({ page }) => {
  await page.route("**/api/vocabulary", (route) => {
    if (route.request().method() !== "POST") return route.continue();
    return route.fulfill({ status: 402, contentType: "application/json",
      body: JSON.stringify({ code: "upgrade_required", message: "You've reached the free plan's 20 saved words." }) });
  });
  await openInFrench(page, "/dashboard?map=food/fruit-veg");
  await wordDot(page, "banane").click();
  await map(page).getByRole("button", { name: "Start learning" }).click();
  await expect(map(page)).toContainText("You've reached the free plan's 20 saved words.");
  await expect(wordDot(page, "banane")).toHaveAttribute("data-status", "new");
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
  await wordDot(page, "pomme").click();
  await expect(map(page).getByTestId("map-word-meaning")).toHaveText("jabłko");
});

test("the band picker changes what counts, and is remembered", async ({ page }) => {
  await openInFrench(page);
  const overall = map(page).getByTestId("map-overall");
  await expect(map(page).getByLabel("Bands counted")).toHaveValue("A1");
  const a1 = await overall.textContent();
  await expect(label(page, "island-label", "food").getByTestId("tile-next")).toHaveText(/^\+\d+ at A2$/);
  const dotsAtA1 = await map(page).locator("circle").count();

  await map(page).getByLabel("Bands counted").selectOption("B1");
  await expect(overall).not.toHaveText(a1!);
  await expect(map(page)).toContainText("B2 words coming soon.");
  await expect(label(page, "island-label", "food").getByTestId("tile-next")).toHaveCount(0);
  expect(await map(page).locator("circle").count()).toBeGreaterThan(dotsAtA1);

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

test("Beyond the core is the uncharted sea, and opens my known words", async ({ page }) => {
  await openInFrench(page);
  await expect(map(page).getByTestId("beyond-core")).toHaveAttribute("aria-label", /^Beyond the core: [\d,]+ words$/);
  await map(page).getByTestId("beyond-core").click();
  await expect(page).toHaveURL(/\/vocabulary\?status=known$/);
  await expect(page.getByLabel("Status")).toHaveValue("known");
});
