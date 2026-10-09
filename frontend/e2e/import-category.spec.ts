import { expect, test } from "@playwright/test";

const MODES = ["Paste text", "From a URL", "Subtitles", "YouTube video"];

test("the import form has no Category field in any mode", async ({ page }) => {
  await page.goto("/import");
  for (const mode of MODES) {
    await page.getByRole("button", { name: mode, exact: true }).click();
    await expect(page.getByRole("combobox", { name: "Language" })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Category" })).toHaveCount(0);
  }
});

test("importing a pasted text sends no category", async ({ page }) => {
  let sent: Record<string, unknown> | null = null;
  await page.route("**/api/texts", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    sent = route.request().postDataJSON();
    await route.fulfill({ status: 201, json: { id: 0 } });
  });
  await page.goto("/import");
  await page.getByRole("textbox", { name: "Title" }).fill("Pain");
  await page.getByRole("textbox", { name: /Text/ }).fill("Mélangez la farine et l'eau.");
  await page.getByRole("button", { name: "Import and start reading" }).click();
  await expect.poll(() => sent).not.toBeNull();
  expect(sent!).not.toHaveProperty("category");
  expect(sent!).toMatchObject({ title: "Pain", content: "Mélangez la farine et l'eau." });
});
