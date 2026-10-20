import { expect, test, type Page } from "@playwright/test";

async function noShelves(page: Page) {
  await page.route("**/api/library/shelves*", (route) => route.fulfill({ json: [] }));
}

const empty = (page: Page) => page.getByTestId("empty");

test("a level with no matches says nothing matches", async ({ page }) => {
  await noShelves(page);
  await page.goto("/community");
  await page.getByRole("combobox", { name: "Level" }).selectOption("A1");
  await expect(empty(page).filter({ hasText: "Nothing matches" })).toContainText("Try another level, type or search.");
  await expect(page.getByText("Nothing shared in this language yet")).toHaveCount(0);
});

test("videos with no matches says nothing matches, with Polly in headphones", async ({ page }) => {
  await noShelves(page);
  await page.goto("/community");
  await page.getByRole("group", { name: "Show" }).getByRole("button", { name: "Videos" }).click();
  const box = empty(page).filter({ hasText: "Nothing matches" });
  await expect(box).toBeVisible();
  await expect(box.locator("[data-polly-prop]")).toHaveAttribute("data-polly-prop", "headphones");
  await expect(page.getByText("Nothing shared in this language yet")).toHaveCount(0);
});

test("with no filter and nothing shared it still says so", async ({ page }) => {
  await noShelves(page);
  await page.goto("/community");
  await expect(empty(page).filter({ hasText: "Nothing shared in this language yet" })).toBeVisible();
});
