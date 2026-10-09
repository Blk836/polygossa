import { expect, test, type Page } from "@playwright/test";
import type { Me } from "../lib/types";

interface Billing {
  enabled: boolean;
  testMode: boolean;
  plan: string | null;
  interval: string | null;
  status: string | null;
  periodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  paymentProblem: boolean;
}

const off: Billing = {
  enabled: true, testMode: true, plan: null, interval: null, status: null, periodEnd: null,
  cancelAtPeriodEnd: false, paymentProblem: false,
};

async function stubBilling(page: Page, state: () => Billing) {
  await page.route("**/api/billing", (route) => route.fulfill({ json: state() }));
  await page.route("**/api/me", async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    const me = (await (await route.fetch()).json()) as Me;
    const b = state();
    const tier = b.plan === null ? "FREE" : b.plan.startsWith("pro") ? "PRO" : "CLASSROOM";
    await route.fulfill({ json: { ...me, plan: { ...me.plan, tier, effectiveTier: tier } } });
  });
}

const section = (page: Page) => page.getByRole("region", { name: "Plan" });

test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: "ignoreErrors" });
});

test("choosing Pro yearly opens Stripe's checkout for that price; test mode and VAT are stated", async ({ page }) => {
  await stubBilling(page, () => off);
  const asked: unknown[] = [];
  await page.route("**/api/billing/checkout", async (route) => {
    asked.push(route.request().postDataJSON());
    await route.fulfill({ json: { url: "https://checkout.stripe.test/cs_1" } });
  });
  await page.route("https://checkout.stripe.test/**", (route) =>
    route.fulfill({ contentType: "text/html", body: "<h1>Stripe Checkout</h1>" }));

  await page.goto("/settings/subscription");
  await expect(section(page)).toContainText("Test mode");
  await expect(section(page)).toContainText("Prices include VAT");
  await section(page).getByRole("button", { name: "€60 a year" }).click();

  await expect(page.getByRole("heading", { name: "Stripe Checkout" })).toBeVisible();
  expect(asked).toEqual([{ plan: "pro_yearly" }]);
});

test("coming back after paying waits for the payment to be confirmed, then shows Pro", async ({ page }) => {
  let calls = 0;
  await stubBilling(page, () => (++calls < 4 ? off : {
    ...off, plan: "pro_monthly", interval: "month", status: "active", periodEnd: "2026-11-08T00:00:00Z",
  }));

  await page.goto("/settings/subscription?checkout=success");
  await expect(section(page)).toContainText("Confirming your payment");
  await expect(section(page)).toContainText("You're on Pro, billed monthly. Renews on 8 November 2026", { timeout: 20000 });
  await expect(section(page)).not.toContainText("Confirming your payment");
});

test("coming back without paying shows the plans as before, with no error", async ({ page }) => {
  await stubBilling(page, () => off);
  await page.goto("/settings/subscription?checkout=cancelled");
  await expect(section(page).getByRole("button", { name: "€8 a month" })).toBeVisible();
  await expect(section(page)).not.toContainText("Confirming");
  await expect(section(page).getByRole("alert")).toHaveCount(0);
});

test("a subscriber manages the subscription in Stripe's portal", async ({ page }) => {
  await stubBilling(page, () => ({
    ...off, plan: "pro_yearly", interval: "year", status: "active", periodEnd: "2027-10-08T00:00:00Z",
  }));
  await page.route("**/api/billing/portal", (route) => route.fulfill({ json: { url: "https://billing.stripe.test/p_1" } }));
  await page.route("https://billing.stripe.test/**", (route) =>
    route.fulfill({ contentType: "text/html", body: "<h1>Stripe portal</h1>" }));

  await page.goto("/settings/subscription");
  await expect(section(page)).toContainText("You're on Pro, billed yearly. Renews on 8 October 2027");
  await expect(section(page).getByRole("button", { name: "€8 a month" })).toHaveCount(0);
  await section(page).getByRole("button", { name: "Manage subscription" }).click();
  await expect(page.getByRole("heading", { name: "Stripe portal" })).toBeVisible();
});

test("a cancelled subscription says when Pro ends; a failed payment asks to update the card", async ({ page }) => {
  let state: Billing = {
    ...off, plan: "pro_monthly", interval: "month", status: "active", periodEnd: "2026-11-08T00:00:00Z",
    cancelAtPeriodEnd: true,
  };
  await stubBilling(page, () => state);
  await page.goto("/settings/subscription");
  await expect(section(page)).toContainText("Pro ends on 8 November 2026");

  state = { ...state, cancelAtPeriodEnd: false, status: "past_due", paymentProblem: true };
  await page.reload();
  await expect(section(page).getByRole("alert")).toContainText("Your last payment didn't go through");
  await expect(section(page).getByRole("alert").getByRole("button", { name: "Update card" })).toBeVisible();
});

test("a teacher chooses the Classroom plan", async ({ page }) => {
  await stubBilling(page, () => off);
  const asked: unknown[] = [];
  await page.route("**/api/billing/checkout", async (route) => {
    asked.push(route.request().postDataJSON());
    await route.fulfill({ status: 503, json: { message: "Payments are unavailable right now. Please try again." } });
  });

  await page.goto("/settings/subscription");
  await section(page).getByRole("button", { name: "€4 per student a month" }).click();

  await expect(section(page).getByRole("alert")).toContainText("Payments are unavailable right now");
  expect(asked).toEqual([{ plan: "classroom_monthly" }]);
});
