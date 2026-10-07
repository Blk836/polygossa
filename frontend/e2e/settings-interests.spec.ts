import { expect, test, type Page } from "@playwright/test";

// docs/acceptance/recommendation-learning.feature, "Interests in Settings". The shared test account's interests must
// never change, so GET and PUT recommendations/interests are answered in the browser.

const section = (page: Page) => page.getByRole("group", { name: "Interests" });
const chip = (page: Page, name: string) => section(page).getByRole("button", { name, exact: true });

async function stubInterests(page: Page, initial: string[], put: (body: { categories: string[] }) => number = () => 200) {
  const sent: { categories: string[] }[] = [];
  await page.route("**/api/recommendations/interests", (route) => {
    if (route.request().method() === "GET") return route.fulfill({ json: { categories: initial } });
    const body = route.request().postDataJSON();
    sent.push(body);
    const status = put(body);
    return status === 200 ? route.fulfill({ json: body }) : route.fulfill({ status, json: { code: "bad_request", message: "Nope" } });
  });
  return sent;
}

test.beforeEach(async ({ page }) => {
  await page.goto("/library"); // signs in
});

test("Settings shows my interests, every category but Other", async ({ page }) => {
  await stubInterests(page, ["food", "travel"]);
  await page.goto("/settings");
  await expect(chip(page, "Food & cooking")).toHaveAttribute("aria-pressed", "true");
  await expect(chip(page, "Travel")).toHaveAttribute("aria-pressed", "true");
  await expect(chip(page, "News & society")).toHaveAttribute("aria-pressed", "false");
  await expect(chip(page, "Other")).toHaveCount(0);
});

test("changing and clearing interests, with no minimum, and without sending the profile", async ({ page }) => {
  const sent = await stubInterests(page, ["food", "travel"]);
  const profile: string[] = [];
  page.on("request", (r) => r.url().endsWith("/api/me") && r.method() === "PATCH" && profile.push(r.url()));
  await page.goto("/settings");
  await chip(page, "News & society").click();
  await chip(page, "Travel").click();
  await section(page).getByRole("button", { name: "Save interests" }).click();
  await expect(section(page).getByText("Saved", { exact: true })).toBeVisible();
  expect(sent.at(-1)!.categories.sort()).toEqual(["food", "news"]);

  await chip(page, "Food & cooking").click();
  await chip(page, "News & society").click();
  await expect(section(page).getByRole("button", { name: "Save interests" })).toBeEnabled();
  await section(page).getByRole("button", { name: "Save interests" }).click();
  await expect(section(page).getByText("Saved", { exact: true })).toBeVisible();
  expect(sent.at(-1)!.categories).toEqual([]);
  expect(profile).toEqual([]);
});

test("a failed save shows the error, not Saved", async ({ page }) => {
  await stubInterests(page, ["food"], () => 400);
  await page.goto("/settings");
  await chip(page, "Travel").click();
  await section(page).getByRole("button", { name: "Save interests" }).click();
  await expect(section(page).getByText("Nope")).toBeVisible();
  await expect(section(page).getByText("Saved", { exact: true })).toHaveCount(0);
});

test("interests that can't be loaded say so instead of showing an empty choice", async ({ page }) => {
  await page.route("**/api/recommendations/interests", (route) => route.fulfill({ status: 500, json: { code: "error", message: "Down" } }));
  await page.goto("/settings");
  await expect(section(page)).toContainText("Your interests couldn't be loaded");
  await expect(section(page).getByRole("button", { name: "Save interests" })).toHaveCount(0);
});
