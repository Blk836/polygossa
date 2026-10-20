import { expect, test } from "@playwright/test";
import { me, signUp } from "./photo-helpers";

test("a name of only spaces is refused on Settings and the name kept", async ({ browser }) => {
  const { context, page } = await signUp(browser, "Ana Blank");
  await page.goto("/settings");
  const name = page.getByLabel("Name", { exact: true });
  await name.fill("   ");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Your name can't be blank." })).toBeVisible();
  await expect(page.getByText("Saved", { exact: true })).toHaveCount(0);
  expect((await me(page)).displayName).toBe("Ana Blank");
  await context.close();
});

test("a name is saved without its outer spaces", async ({ browser }) => {
  const { context, page } = await signUp(browser, "Ana Blank");
  await page.goto("/settings");
  await page.getByLabel("Name", { exact: true }).fill("  Ana  ");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  expect((await me(page)).displayName).toBe("Ana");
  await context.close();
});
