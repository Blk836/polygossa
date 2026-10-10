import { expect, test } from "@playwright/test";

test("Settings › Profile picks a native language, saved with the profile", async ({ page }) => {
  await page.goto("/library");
  const me = await (await page.request.get("/api/me")).json();
  let sent: Record<string, unknown> | null = null;
  await page.route("**/api/me", (route) => {
    if (route.request().method() !== "PATCH") return route.continue();
    sent = route.request().postDataJSON();
    return route.fulfill({ json: { ...me, ...sent } });
  });
  await page.goto("/settings");
  const select = page.getByLabel("Your native language");
  await expect(select).toHaveValue("en");
  await expect(select.locator("option").first()).toHaveText("English");
  await select.selectOption("es");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  expect(sent).toMatchObject({ nativeLanguage: "es" });
});
