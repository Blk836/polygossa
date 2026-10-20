import { expect, test } from "@playwright/test";

for (const path of ["/read/99999", "/no-such-page-here"]) {
  test(`"Page not found" at ${path} has one main landmark`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
    await expect(page.locator('svg[data-polly="sorry"]')).toBeVisible();
    await expect(page.getByRole("link", { name: "Go home" })).toBeVisible();
    await expect(page.locator("main")).toHaveCount(1);
    await expect(page.getByRole("main")).toHaveCount(1);
  });
}
