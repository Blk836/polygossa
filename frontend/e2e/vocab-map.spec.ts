import { expect, test } from "@playwright/test";
import {
  bandButton,
  cleanUpAfterEach,
  country,
  label,
  map,
  openInFrench,
  pickLanguage,
  province,
  restingZoom,
  save,
  tileCount,
  touched,
  wordText,
  wordTile,
  world,
} from "./vocab-map-helpers";

// The vocabulary map on Progress (docs/acceptance/vocabulary-map.feature): the hex continent, its counts, bands and
// words. The camera and the floating controls' tests are in vocab-map-camera.spec.ts; the helpers and the shared test
// user's rules in vocab-map-helpers.ts.

cleanUpAfterEach();

interface ApiMap {
  regions: { id: string; areas: { id: string; words: { band: string }[] }[] }[];
}

test("without a target language the map asks me to pick one", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(map(page)).toContainText("Pick the language you're learning");
  await expect(world(page)).toHaveCount(0);
});

test("the map is one continent above the period comparison, with a country per region and a tile per word", async ({ page }) => {
  await openInFrench(page);
  await expect(map(page).getByTestId("map-region")).toHaveCount(14);
  await expect(map(page).getByTestId("region-label")).toHaveCount(14);
  await expect(map(page).getByTestId("beyond-core")).toBeVisible();
  await expect(map(page).getByTestId("map-overall")).toHaveText(/^[\d,]+ of [\d,]+ core words known$/);
  await expect(country(page, "Food & Drink")).toHaveAttribute("aria-label", /^Food & Drink: \d+ of \d+ known$/);
  await expect(label(page, "region-label", "food").getByTestId("tile-count")).toHaveText(/^\d+ \/ \d+$/);
  // Bigger regions are bigger countries: Core words holds the most words, Communication the fewest.
  const core = (await country(page, "Core words").boundingBox())!;
  const communication = (await country(page, "Communication").boundingBox())!;
  expect(core.width * core.height).toBeGreaterThan(communication.width * communication.height * 3);
  // A tile per word in the list, every band, from far away too.
  const list: ApiMap = await (await page.request.get("/api/vocab-map?language=fr")).json();
  const words = list.regions.flatMap((r) => r.areas.flatMap((a) => a.words)).length;
  expect(words).toBeGreaterThan(1000);
  expect(await tileCount(page)).toBe(words);

  const mapBox = (await map(page).boundingBox())!;
  const periodBox = (await page.getByRole("region", { name: "Last week" }).boundingBox())!;
  expect(mapBox.y).toBeLessThan(periodBox.y);
  await expect(page.getByRole("region", { name: "Skill levels" })).toBeVisible();
});

test("pointing at a country shows more on its name tag", async ({ page }) => {
  await openInFrench(page);
  const more = label(page, "region-label", "food").locator(".more");
  await expect(more).toHaveCSS("opacity", "0");
  await country(page, "Food & Drink").hover();
  await expect(more).toHaveCSS("opacity", "1");
  await expect(more).toContainText(/\+\d+ at A2/);
});

test("tapping glides into a country and a province, and the breadcrumb, Back and a reload keep up", async ({ page }) => {
  await openInFrench(page);
  const out = await restingZoom(page);
  await country(page, "Food & Drink").click();
  await expect(map(page).getByTestId("map-area")).toHaveCount(6);
  await expect(label(page, "area-label", "fruit-veg")).toContainText("Fruit & vegetables");
  await expect(label(page, "region-label", "food")).toHaveCount(0);
  const atCountry = await restingZoom(page);
  expect(atCountry).toBeGreaterThan(out * 2);

  await province(page, "Fruit & vegetables").click();
  await expect(map(page).getByTestId("map-breadcrumb")).toHaveText("Map›Food & Drink›Fruit & vegetables");
  await expect(wordText(page, "pomme")).toBeVisible();
  expect(await restingZoom(page)).toBeGreaterThan(atCountry);
  expect(new URL(page.url()).searchParams.get("map")).toBe("food/fruit-veg");

  await page.reload();
  await pickLanguage(page, "Français");
  await expect(wordTile(page, "pomme")).toBeVisible();

  await page.goBack();
  await expect(map(page).getByTestId("map-breadcrumb")).toHaveText("Map›Food & Drink");
  await expect(map(page).getByTestId("map-word")).toHaveCount(0);
  await map(page).getByRole("button", { name: "Zoom out" }).click();
  await expect(map(page).getByTestId("map-breadcrumb")).toHaveText("Map");
  await expect(map(page).getByTestId("region-label")).toHaveCount(14);
  expect(await restingZoom(page)).toBeCloseTo(out, 3);

  await country(page, "Home").click();
  await map(page).getByRole("button", { name: "Map", exact: true }).click();
  await expect(map(page).getByTestId("map-area")).toHaveCount(0);
});

test("a word counts in the form I know it, and tapping it shows its meaning over the map", async ({ page }) => {
  await save(page, "mangé", "known");
  await openInFrench(page, "/dashboard?map=food/cooking");
  await expect(wordTile(page, "manger")).toHaveAttribute("data-status", "known");
  await wordTile(page, "manger").click();
  const panel = map(page).getByTestId("map-word-panel");
  await expect(panel.getByTestId("map-word-meaning")).toHaveText("to eat");
  await expect(panel.getByTestId("map-word-status")).toHaveText("Known");
  await expect(panel.getByRole("button", { name: "I know this" })).toHaveCount(0);
  // The panel floats over the map, and closes.
  const [box, mapBox] = [(await panel.boundingBox())!, (await world(page).boundingBox())!];
  expect(box.y + box.height).toBeLessThanOrEqual(mapBox.y + mapBox.height);
  expect(box.y).toBeGreaterThan(mapBox.y);
  await panel.getByRole("button", { name: "Close" }).click();
  await expect(panel).toHaveCount(0);
});

test("an ignored word shows as ignored and leaves its province's total", async ({ page }) => {
  await openInFrench(page, "/dashboard?map=core");
  const count = label(page, "area-label", "pronouns").getByTestId("tile-count");
  await expect(count).toHaveText(/^\d+ \/ \d+$/);
  const total = Number((await count.textContent())!.split(" / ")[1]);
  await save(page, "je", "ignored");
  await page.reload();
  await pickLanguage(page, "Français");
  await expect(count).toHaveText(new RegExp(`/ ${total - 1}$`));
  await province(page, "Pronouns").click();
  await expect(wordTile(page, "je")).toHaveAttribute("data-status", "ignored");
});

test("I start learning a word from the map, then mark one known, and the tiles change colour", async ({ page }) => {
  touched.push("poire", "pomme");
  await openInFrench(page, "/dashboard?map=food");
  await expect(label(page, "area-label", "fruit-veg").getByTestId("tile-learning")).toHaveCount(0);
  await province(page, "Fruit & vegetables").click();
  const [learning, known] = [await tileCount(page, "learning"), await tileCount(page, "known")];

  await wordTile(page, "poire").click();
  const panel = map(page).getByTestId("map-word-panel");
  await expect(panel).toContainText("pear");
  await panel.getByRole("button", { name: "Start learning" }).click();
  await expect(wordTile(page, "poire")).toHaveAttribute("data-status", "learning");
  expect(await tileCount(page, "learning")).toBe(learning + 1);
  const saved = await (await page.request.get("/api/vocabulary?language=fr&status=learning&q=poire")).json();
  expect(saved.items.map((e: { term: string }) => e.term)).toContain("poire");

  await wordTile(page, "pomme").click();
  await panel.getByRole("button", { name: "I know this" }).click();
  await expect(wordTile(page, "pomme")).toHaveAttribute("data-status", "known");
  expect(await tileCount(page, "known")).toBe(known + 1);

  await map(page).getByTestId("map-breadcrumb").getByRole("button", { name: "Food & Drink" }).click();
  await expect(label(page, "area-label", "fruit-veg").getByTestId("tile-learning")).toHaveText("1 learning");
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

test("the band switch changes what counts and how tiles are coloured, and is remembered", async ({ page }) => {
  await openInFrench(page);
  const overall = map(page).getByTestId("map-overall");
  await expect(bandButton(page, "A1")).toHaveAttribute("aria-pressed", "true");
  await expect(map(page).getByRole("group", { name: "Bands counted" }).getByRole("button")).toHaveText(["Up to A1", "Up to A2", "Up to B1"]);
  const a1 = await overall.textContent();
  await expect(label(page, "region-label", "food").getByTestId("tile-next")).toHaveText(/^\+\d+ at A2$/);
  expect(await tileCount(page, "next")).toBeGreaterThan(0);
  expect(await tileCount(page, "later")).toBeGreaterThan(0);

  await bandButton(page, "B1").click();
  await expect(bandButton(page, "B1")).toHaveAttribute("aria-pressed", "true");
  await expect(overall).not.toHaveText(a1!);
  await expect(map(page)).toContainText("B2 words coming soon.");
  await expect(label(page, "region-label", "food").getByTestId("tile-next")).toHaveCount(0);
  expect(await tileCount(page, "next")).toBe(0);
  expect(await tileCount(page, "later")).toBe(0);

  await page.reload();
  await pickLanguage(page, "Français");
  await expect(bandButton(page, "B1")).toHaveAttribute("aria-pressed", "true");
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
