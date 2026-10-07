import { expect, test } from "@playwright/test";

// docs/acceptance/english.feature: English is offered wherever languages are listed, first.

test("the top-bar language switcher offers English first, and picking it switches to English", async ({ page }) => {
  await page.goto("/library"); // signs in
  const me = await (await page.request.get("/api/me")).json();
  // Answer the switch in the browser: the shared test account's language must stay unset.
  await page.route("**/api/me", (route) => {
    if (route.request().method() !== "PATCH") return route.continue();
    const { targetLanguage } = route.request().postDataJSON();
    return route.fulfill({ json: { ...me, targetLanguage } });
  });
  await page.reload();
  await page.getByRole("banner").getByRole("button", { name: /Change language/ }).click();
  const options = page.getByRole("menu", { name: "Language" }).getByRole("menuitemradio");
  await expect(options.first()).toContainText("English");
  await expect(options).toHaveCount(6); // Japanese, Chinese and Korean are paused (learning-languages.feature)
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
