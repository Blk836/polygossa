import { expect, test, type Page } from "@playwright/test";
import type { Me, Tier } from "../lib/types";

const strip = (page: Page) => page.getByRole("navigation", { name: "Settings pages" });
const topNav = (page: Page) => page.getByRole("banner").getByRole("navigation", { name: "Main" });
const planCard = (page: Page, name: string) => page.getByTestId("plan-card").filter({ has: page.getByText(name, { exact: true }) });

const FREE_PLAN = { limits: { texts: 5, savedWords: 500 }, usage: { texts: 2, savedWords: 40 } };

async function stubPlanChange(page: Page, extra: (tier: Tier) => Partial<Me["plan"]> = () => ({})) {
  await page.route("**/api/me/plan", async (route) => {
    const me = (await (await page.request.get("/api/me")).json()) as Me;
    const { tier } = route.request().postDataJSON() as { tier: Tier };
    await route.fulfill({ json: { ...me, plan: { ...me.plan, tier, effectiveTier: tier, ...extra(tier) } } });
  });
}

test("/settings shows the strip with Profile current and no main tab marked", async ({ page }) => {
  await page.goto("/settings");
  await expect(strip(page).getByRole("link")).toHaveText(["Profile", "Appearance", "Subscription", "Privacy"]);
  await expect(strip(page).locator("[aria-current=page]")).toHaveText("Profile");
  await expect(topNav(page).locator("[aria-current=page]")).toHaveCount(0);
});

for (const [tab, url, shown, hidden] of [
  ["Profile", "/settings", (p: Page) => p.getByLabel("Name"), (p: Page) => p.getByTestId("plan-card")],
  ["Appearance", "/settings/appearance", (p: Page) => p.getByRole("radiogroup", { name: "Theme" }), (p: Page) => p.getByLabel("Name")],
  ["Subscription", "/settings/subscription", (p: Page) => p.getByTestId("plan-card"), (p: Page) => p.getByRole("radiogroup", { name: "Theme" })],
  ["Privacy", "/settings/privacy", (p: Page) => p.getByRole("link", { name: "Download my data" }), (p: Page) => p.getByTestId("plan-card")],
] as const) {
  test(`the ${tab} sub-tab opens ${url}`, async ({ page }) => {
    await page.goto(tab === "Profile" ? "/settings/subscription" : "/settings");
    await strip(page).getByRole("link", { name: tab }).click();
    await expect(page).toHaveURL(new RegExp(`${url}$`));
    await expect(strip(page).locator("[aria-current=page]")).toHaveText(tab);
    await expect(shown(page).first()).toBeVisible();
    await expect(hidden(page)).toHaveCount(0);
  });
}

test("Subscription lists Free, Pro and Classroom", async ({ page }) => {
  await page.goto("/settings/subscription");
  await expect(page.getByTestId("plan-card")).toHaveCount(3);
  for (const name of ["Free", "Pro", "Classroom"]) await expect(planCard(page, name)).toBeVisible();
  await expect(planCard(page, "Classroom").getByRole("button")).toHaveText("Current plan");
});

test("Classes has no settings strip", async ({ page }) => {
  await page.goto("/classes");
  await expect(page.getByRole("heading", { name: "Classes" }).first()).toBeVisible();
  await expect(strip(page)).toHaveCount(0);
});

test("saving the profile updates the account menu", async ({ page }) => {
  await page.goto("/settings");
  const before = (await (await page.request.get("/api/me")).json()) as Me;
  const name = `Tab tester ${Date.now()}`;
  try {
    await page.getByLabel("Name").fill(name);
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Saved", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Account" }).click();
    await expect(page.getByRole("menu", { name: "Account" })).toContainText(name);
  } finally {
    await page.request.patch("/api/me", { data: { displayName: before.displayName } });
  }
});

test("a failed profile save shows the error, not Saved", async ({ page }) => {
  await page.route("**/api/me", (route) =>
    route.request().method() === "PATCH"
      ? route.fulfill({ status: 400, json: { code: "bad_request", message: "Name is not allowed." } })
      : route.fallback(),
  );
  await page.goto("/settings");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("Name is not allowed.");
  await expect(page.getByText("Saved", { exact: true })).toHaveCount(0);
});

test("switching plan marks the new one current and updates the account badge", async ({ page }) => {
  await stubPlanChange(page);
  await page.goto("/settings/subscription");
  await planCard(page, "Pro").getByRole("button", { name: "Switch to Pro" }).click();
  await expect(planCard(page, "Pro").getByRole("button")).toHaveText("Current plan");
  await expect(planCard(page, "Classroom").getByRole("button")).toHaveText("Switch to Classroom");
  await page.getByRole("button", { name: "Account" }).click();
  await expect(page.getByTestId("account-plan")).toHaveText("Pro plan");
});

test("a failed plan switch shows the error and keeps the plan", async ({ page }) => {
  await page.route("**/api/me/plan", (route) => route.fulfill({ status: 500, json: { code: "error", message: "Billing is down." } }));
  await page.goto("/settings/subscription");
  await planCard(page, "Pro").getByRole("button", { name: "Switch to Pro" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("Billing is down.");
  await expect(planCard(page, "Classroom").getByRole("button")).toHaveText("Current plan");
});

test("usage shows only on a limited plan", async ({ page }) => {
  await stubPlanChange(page, (tier) => (tier === "FREE" ? FREE_PLAN : {}));
  await page.goto("/settings/subscription");
  await expect(page.getByText(/^Usage:/)).toHaveCount(0);
  await planCard(page, "Free").getByRole("button", { name: "Downgrade" }).click();
  await expect(page.getByText("Usage: 2/5 texts · 40/500 saved words")).toBeVisible();
});

test("Pro through a teacher's Classroom plan is explained", async ({ page }) => {
  await stubPlanChange(page, () => ({ sponsoredByClassroom: true }));
  await page.goto("/settings/subscription");
  await expect(page.getByText(/through your teacher/)).toHaveCount(0);
  await planCard(page, "Free").getByRole("button", { name: "Downgrade" }).click();
  await expect(page.getByText("You have Pro features through your teacher's Classroom plan.")).toBeVisible();
});

for (const [hash, url, tab] of [
  ["#plan", "/settings/subscription", "Subscription"],
  ["#appearance", "/settings/appearance", "Appearance"],
] as const) {
  test(`/settings${hash} lands on ${url}`, async ({ page }) => {
    await page.goto(`/settings${hash}`);
    await expect(page).toHaveURL(new RegExp(`${url}$`));
    await expect(strip(page).locator("[aria-current=page]")).toHaveText(tab);
  });
}

test.describe("phones", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("the strip fits and the page doesn't scroll sideways", async ({ page }) => {
    await page.goto("/settings/subscription");
    await expect(strip(page).locator("[aria-current=page]")).toHaveText("Subscription");
    await expect(strip(page).locator("[aria-current=page]")).toBeInViewport();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
