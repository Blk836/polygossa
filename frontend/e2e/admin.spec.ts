import { expect, test } from "@playwright/test";

// docs/acceptance/admin-panel.feature. The shared test account is an admin in development (FORUM_ADMINS).

test("the account menu leads admins to the panel, with stats", async ({ page }) => {
  await page.goto("/library");
  await page.getByRole("button", { name: "Account" }).click();
  await page.getByRole("menu", { name: "Account" }).getByRole("menuitem", { name: "Admin" }).click();
  await page.waitForURL("**/admin");
  for (const tile of ["Users", "Active today", "Active this week", "Active this month"]) {
    await expect(page.getByTestId("admin-tiles").getByText(tile, { exact: true })).toBeVisible();
  }
  await expect(page.getByRole("region", { name: "Users per plan" })).toContainText("Classroom");
  await expect(page.getByRole("img", { name: /Daily active users/ })).toBeVisible();
  await expect(page.getByRole("img", { name: /Sign-ups/ })).toBeVisible();
});

test("an admin finds a learner, suspends them after confirming, and lifts it", async ({ page, playwright }) => {
  const baseURL = test.info().project.use.baseURL;
  const email = `admin-e2e-${Date.now()}@test.co`;
  const other = await playwright.request.newContext({ baseURL });
  const res = await other.post("/api/auth/signup", { data: { email, password: "password123", displayName: "Spammy" } });
  expect(res.ok(), await res.text()).toBe(true);

  await page.goto("/admin");
  await page.getByPlaceholder("Search by email or name").fill(email);
  await page.getByPlaceholder("Search by email or name").press("Enter");
  await page.getByRole("row").filter({ hasText: email }).getByRole("button", { name: "Open" }).click();
  const panel = page.getByRole("region", { name: `User ${email}` });
  await expect(panel).toBeVisible();

  await panel.getByLabel("Reason").fill("spam");
  await panel.getByRole("button", { name: "Suspend" }).click();
  await expect(panel.getByText(`Suspend ${email}?`)).toBeVisible();
  await panel.getByRole("button", { name: "Yes, suspend" }).click();
  await expect(panel.getByTestId("admin-status")).toHaveText("Suspended: spam");
  expect((await other.get("/api/me")).status()).toBe(403);

  await panel.getByRole("button", { name: "Lift suspension" }).click();
  await panel.getByRole("button", { name: "Yes, lift suspension" }).click();
  await expect(panel.getByTestId("admin-status")).toHaveText("Active");
  expect((await other.get("/api/me")).status()).toBe(200);

  await expect(page.getByRole("region", { name: "Recent actions" })).toContainText(email);
  await other.dispose();
});

test("learners never see the panel", async ({ page }) => {
  await page.goto("/library");
  const me = await (await page.request.get("/api/me")).json();
  await page.route("**/api/me", (route) => route.fulfill({ json: { ...me, admin: false } }));
  await page.reload();
  await page.getByRole("button", { name: "Account" }).click();
  await expect(page.getByRole("menu", { name: "Account" }).getByRole("menuitem", { name: "Admin" })).toHaveCount(0);
});
