import { expect, test } from "@playwright/test";

// The default brand (BRAND_NAME unset). Pages without their own title get the site title; titled pages get the suffix.
test("the app is branded Polygossa, with no trace of the old Lector name", async ({ page }) => {
  await page.goto("/library");
  const home = page.getByRole("link", { name: "Polygossa home" });
  await expect(home).toBeVisible();
  await expect(home).toHaveText("Polygossa.");
  await expect(page).toHaveTitle("Polygossa — learn languages by reading");
  await expect(page.locator("body")).not.toContainText("Lector");
});

test("a page with its own title is suffixed with the brand", async ({ page }) => {
  await page.goto("/library"); // signs in (auto-login) for page.request
  const res = await page.request.post("/api/texts", {
    data: { title: `Brand check ${Date.now()}`, language: "fr", content: "Le chat dort.", isPublic: false },
  });
  expect(res.ok(), await res.text()).toBe(true);
  const { id } = await res.json();
  try {
    await page.goto(`/read/${id}`);
    await expect(page).toHaveTitle(/^Brand check \d+ · Polygossa$/);
    await expect(page.locator("body")).not.toContainText("Lector");
  } finally {
    await page.request.delete(`/api/texts/${id}`);
  }
});

test("internal names are unchanged, so existing sessions and preferences carry over", async ({ page, context }) => {
  await page.goto("/library");
  expect((await context.cookies()).map((c) => c.name)).toContain("lector_token");
  const me = await (await page.request.get("/api/me")).json();
  expect(me.email).toBe("test@lector.local");
});
