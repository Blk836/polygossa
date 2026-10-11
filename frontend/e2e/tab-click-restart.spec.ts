import { expect, test, type Page } from "@playwright/test";
import { answerBox, answerFor, handIn, proLearner, results, startTest, subTab } from "./writing-helpers";

const topTab = (page: Page, name: RegExp) => page.getByRole("banner").getByRole("navigation", { name: "Main" }).getByRole("link", { name });
const exploreSearch = (page: Page) => page.getByRole("searchbox", { name: "Search titles" });

async function searchExplore(page: Page) {
  await page.goto("/community");
  await exploreSearch(page).fill("zzz-nothing-matches");
  await exploreSearch(page).press("Enter");
  await expect(page.getByText("“zzz-nothing-matches”")).toBeVisible();
}

test.describe("clicking the tab you are on", () => {
  test("Writing results → Write goes back to the Writing start page", async ({ browser }) => {
    const { context, page } = await proLearner(browser);
    const t = await startTest(page);
    await page.goto("/writing");
    await answerBox(page).fill(answerFor(t));
    await handIn(page).click();
    await expect(results(page)).toBeVisible();

    await subTab(page, "Write").click();
    await expect(page.locator("[data-tour=writing-start]")).toBeVisible();
    await expect(results(page)).toHaveCount(0);
    await expect(page.getByText(`Situation · ${t.level}`, { exact: true })).toHaveCount(0);
    await context.close();
  });

  test("the Practice tab takes Review out of Practise ahead", async ({ browser }) => {
    const { context, page } = await proLearner(browser);
    await page.goto("/review");
    await page.getByRole("button", { name: "Practise ahead" }).click();
    await expect(page.getByText("Nothing left to practise")).toBeVisible();

    await topTab(page, /^Practice/).click();
    await expect(page.getByText("All caught up!")).toBeVisible();
    await expect(page.getByRole("button", { name: "Practise ahead" })).toBeVisible();
    await context.close();
  });

  test("Explore with a search goes back to its shelves", async ({ page }) => {
    await searchExplore(page);
    await subTab(page, "Explore").click();
    await expect(exploreSearch(page)).toHaveValue("");
    await expect(page.getByText("“zzz-nothing-matches”")).toHaveCount(0);
  });

  test("the logo takes Explore back to its shelves", async ({ page }) => {
    await searchExplore(page);
    await page.getByRole("link", { name: /home$/ }).click();
    await expect(exploreSearch(page)).toHaveValue("");
    await expect(page.getByText("“zzz-nothing-matches”")).toHaveCount(0);
  });

  test("Words drops the address's filter and the typed search", async ({ page }) => {
    await page.goto("/vocabulary?status=known");
    await expect(page.getByRole("combobox", { name: "Status" })).toHaveValue("known");
    await page.getByPlaceholder("Search words or definitions…").fill("zzz");

    await subTab(page, "Words").click();
    await expect(page).toHaveURL(/\/vocabulary$/);
    await expect(page.getByRole("combobox", { name: "Status" })).toHaveValue("learning");
    await expect(page.getByPlaceholder("Search words or definitions…")).toHaveValue("");
  });

  test("a page started afresh opens at the top", async ({ page }) => {
    await page.goto("/community");
    await expect(exploreSearch(page)).toBeVisible();
    await page.evaluate(() => {
      const spacer = document.createElement("div");
      spacer.style.height = "4000px";
      document.body.appendChild(spacer);
      window.scrollTo(0, 2000);
    });
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(1000);

    await subTab(page, "Explore").click();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  });

  test("a writing test in progress is left alone", async ({ browser }) => {
    const { context, page } = await proLearner(browser);
    await startTest(page);
    await page.goto("/writing");
    await answerBox(page).fill("perro gato casa");

    await subTab(page, "Write").click();
    await page.waitForTimeout(1_000);
    await expect(answerBox(page)).toHaveValue("perro gato casa");
    await expect(page.getByRole("timer")).toBeVisible();
    await context.close();
  });

  test("clicking a different tab still just goes there", async ({ page }) => {
    await searchExplore(page);
    await subTab(page, "My library").click();
    await expect(page).toHaveURL(/\/library$/);
    await expect(page.getByRole("heading", { name: "My library", level: 1 })).toBeVisible();
  });
});
