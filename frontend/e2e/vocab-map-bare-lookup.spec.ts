import { expect, test } from "@playwright/test";
import { cleanUpAfterEach, map, openInFrench, wordTile } from "./vocab-map-helpers";

cleanUpAfterEach();

test("the vocabulary map looks a word up on its own, which the AI answers", async ({ page }) => {
  await page.route("**/api/vocab-map?**", async (route) => {
    const body = await (await route.fetch()).json();
    body.meaningLanguage = "pl";
    for (const region of body.regions) for (const area of region.areas) for (const w of area.words) w.meaning = null;
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
  const asked: URL[] = [];
  await page.route("**/api/dictionary?**", (route) => {
    asked.push(new URL(route.request().url()));
    return route.fulfill({ json: { term: "pomme", language: "fr", meanings: ["jabłko"], meaningLanguage: "pl", source: "sentence" } });
  });
  await openInFrench(page, "/dashboard?map=food/fruit-veg");
  await wordTile(page, "pomme").click();
  await expect(map(page).getByTestId("map-word-meaning")).toHaveText("jabłko");
  expect(asked.map((u) => u.searchParams.get("bare"))).toEqual(["true"]);
});
