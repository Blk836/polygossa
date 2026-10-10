import { expect, test } from "@playwright/test";

test("the top-bar language switcher offers English first, and picking it switches to English", async ({ page }) => {
  await page.goto("/library");
  const me = await (await page.request.get("/api/me")).json();
  await page.route("**/api/me", (route) => {
    if (route.request().method() !== "PATCH") return route.continue();
    const { targetLanguage } = route.request().postDataJSON();
    return route.fulfill({ json: { ...me, targetLanguage } });
  });
  await page.reload();
  await page.getByRole("banner").getByRole("button", { name: /Change language/ }).click();
  const options = page.getByRole("menu", { name: "Language" }).getByRole("menuitemradio");
  await expect(options.first()).toContainText("English");
  await expect(options).toHaveCount(6);
  await options.first().click();
  await expect(page.getByRole("banner").getByRole("button", { name: "Studying English. Change language" })).toBeVisible();
});

test("the landing demo reads an English sentence", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/");
  const demo = page.getByTestId("demo");
  await demo.getByRole("tab", { name: "English" }).click();
  await demo.getByTestId("demo-text").getByRole("button", { name: "neighbour", exact: true }).click();
  await expect(demo.getByTestId("demo-card")).toContainText("a person who lives next door");
  await context.close();
});
