import { expect, test, type Page } from "@playwright/test";

// The landing page (/) for visitors with no session. Playwright starts every test without cookies, so / shows it
// even though auto-login is on in dev; sign-up itself can't run here (auto-login sends /signup to the library), so
// links are checked by their href.
const SIGNUP = /^\/signup(\?lang=(es|fr|de|it|pt|ja|zh|ko))?$/;
const NATIVE = ["Español", "Français", "Deutsch", "Italiano", "Português", "日本語", "中文", "한국어"];

const demo = (page: Page) => page.getByTestId("demo");
const demoWord = (page: Page, text: string) => demo(page).getByTestId("demo-text").getByRole("button", { name: text, exact: true });

test.describe("landing page", () => {
  test("signed-out visitors get the landing page with sign-up in the header and hero", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Learn a language");
    const header = page.getByRole("banner");
    await expect(header.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
    await expect(header.getByRole("link", { name: "Start free" })).toHaveAttribute("href", "/signup");
    await expect(page.getByRole("link", { name: "Start reading free" }).first()).toHaveAttribute("href", "/signup");
    await expect(page.getByText("no credit card").first()).toBeVisible();
  });

  test("the hero's language picker starts sign-up in each of the 8 languages", async ({ page }) => {
    await page.goto("/");
    const picker = page.getByRole("list", { name: "Languages" }).first();
    await expect(picker.getByRole("link")).toHaveText(NATIVE);
    await expect(picker.getByRole("link", { name: "Français" })).toHaveAttribute("href", "/signup?lang=fr");
    await expect(picker.getByRole("link", { name: "日本語" })).toHaveAttribute("href", "/signup?lang=ja");
  });

  test("clicking a demo word shows its meaning and makes it learning", async ({ page }) => {
    await page.goto("/");
    await expect(demo(page).getByText("Tap a")).toBeVisible();
    await expect(demo(page).getByRole("link", { name: /create a free account/ })).toHaveCount(0);
    const word = demoWord(page, "mañana");
    await expect(word).toHaveAttribute("data-status", "new");
    await word.click();
    const card = demo(page).getByTestId("demo-card");
    await expect(card).toContainText("mañana");
    await expect(card).toContainText("morning");
    await expect(word).toHaveAttribute("data-status", "learning");
    await expect(word).toHaveClass(/w-learning/);
    await expect(demo(page).getByRole("link", { name: /create a free account/ })).toHaveAttribute("href", "/signup?lang=es");
  });

  test("marking a demo word known adds one to the known count, once", async ({ page }) => {
    await page.goto("/");
    const known = demo(page).getByTestId("demo-known");
    const before = Number(await known.textContent());
    await demoWord(page, "mar").click();
    const knownButton = demo(page).getByTestId("demo-card").getByRole("button", { name: "Known" });
    await knownButton.click();
    await expect(known).toHaveText(String(before + 1));
    await expect(demoWord(page, "mar")).toHaveAttribute("data-status", "known");
    await knownButton.click();
    await expect(known).toHaveText(String(before + 1));
  });

  test("switching the demo language resets it and the nudge follows the language", async ({ page }) => {
    await page.goto("/");
    await demoWord(page, "mar").click();
    await demo(page).getByTestId("demo-card").getByRole("button", { name: "Known" }).click();
    await demo(page).getByRole("tab", { name: "日本語" }).click();
    await expect(demo(page).getByRole("tab", { name: "日本語" })).toHaveAttribute("aria-selected", "true");
    await expect(demo(page).getByTestId("demo-text")).toHaveText("毎朝、私は駅の近くでコーヒーを飲みます。");
    await expect(demo(page).getByTestId("demo-card")).toHaveCount(0);
    await expect(demo(page).getByRole("link", { name: /create a free account/ })).toHaveCount(0);
    await demoWord(page, "毎朝").click();
    await expect(demo(page).getByTestId("demo-card")).toContainText("every morning");
    await expect(demo(page).getByRole("link", { name: /create a free account/ })).toHaveAttribute("href", "/signup?lang=ja");
  });

  test("demo words open from the keyboard", async ({ page }) => {
    await page.goto("/");
    await demoWord(page, "pequeño").focus();
    await page.keyboard.press("Enter");
    await expect(demo(page).getByTestId("demo-card")).toContainText("small");
  });

  test("pricing shows the real free-plan limits and every plan leads to sign-up", async ({ page }) => {
    await page.goto("/");
    const pricing = page.locator("#pricing");
    await expect(pricing).toContainText("5 imported texts");
    await expect(pricing).toContainText("500 saved words");
    for (const plan of ["Free", "Pro", "Classroom"]) await expect(pricing.getByRole("heading", { name: plan, exact: true })).toBeVisible();
    const ctas = pricing.getByRole("link");
    await expect(ctas).toHaveCount(3);
    for (const href of await ctas.evaluateAll((as) => as.map((a) => a.getAttribute("href")))) expect(href).toBe("/signup");
  });

  test("FAQ answers open and close", async ({ page }) => {
    await page.goto("/");
    const answer = page.getByText("Every text shows its estimated level");
    await expect(answer).toBeHidden();
    const question = page.getByText("Do I need to be a beginner", { exact: false });
    await question.click();
    await expect(answer).toBeVisible();
    await question.click();
    await expect(answer).toBeHidden();
  });

  test("the page ends with the picker and CTA again, and every sign-up link is well-formed", async ({ page }) => {
    await page.goto("/");
    const pickers = page.getByRole("list", { name: "Languages" });
    await expect(pickers).toHaveCount(2);
    await expect(pickers.last().getByRole("link")).toHaveText(NATIVE);
    await expect(page.getByRole("link", { name: "Start reading free" })).toHaveCount(2);
    const hrefs = await page.locator('a[href^="/signup"]').evaluateAll((as) => as.map((a) => a.getAttribute("href")!));
    expect(hrefs.length).toBeGreaterThanOrEqual(20);
    for (const href of hrefs) expect(href).toMatch(SIGNUP);
  });

  test("signed-in visitors are offered the library instead of sign-up", async ({ page }) => {
    await page.goto("/library"); // auto-login
    await page.goto("/");
    await expect(page).toHaveURL("/");
    const header = page.getByRole("banner");
    await expect(header.getByRole("link", { name: "Open library" })).toHaveAttribute("href", "/library");
    await expect(header.getByRole("link", { name: "Start free" })).toHaveCount(0);
  });

  test("app pages still auto-sign-in from a fresh session", async ({ page }) => {
    await page.goto("/library");
    await expect(page).toHaveURL(/\/library$/);
  });

  test("on a phone nothing overflows and the primary CTA is above the fold", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBe(0);
    await expect(page.getByRole("link", { name: "Start reading free" }).first()).toBeInViewport();
  });
});

// Choosing a language sets the account's target language, which the API can't clear again (null is ignored) and other
// specs rely on the test account having none, so PATCH /api/me is stubbed and checked instead of sent.
test.describe("onboarding with a language chosen on the landing page", () => {
  test("?lang=de starts at step 2 with German selected and sets German as the target language", async ({ page }) => {
    await page.goto("/library");
    const me = await (await page.request.get("/api/me")).json();
    const patches: unknown[] = [];
    await page.route("**/api/me", (route) => {
      if (route.request().method() !== "PATCH") return route.fallback();
      const body = route.request().postDataJSON();
      patches.push(body);
      return route.fulfill({ json: { ...me, ...body } });
    });
    await page.goto("/onboarding?lang=de");
    await expect(page.getByRole("button", { name: /Deutsch/ })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("heading", { name: "Pick something to read" })).toBeVisible();
    await expect(page.getByRole("main").getByRole("button").filter({ hasText: "words →" }).or(page.getByText("No starter texts yet"))).not.toHaveCount(0);
    expect(patches.length).toBeGreaterThan(0); // React strict mode (dev) may run the effect twice
    for (const body of patches) expect(body).toMatchObject({ targetLanguage: "de" });
  });

  test.describe("without a usable language", () => {
    for (const path of ["/onboarding", "/onboarding?lang=xx"]) {
      test(`${path} asks for one`, async ({ page }) => {
        await page.goto(path);
        await expect(page.getByRole("heading", { name: "What are you learning?" })).toBeVisible();
        await expect(page.getByRole("button", { name: /Deutsch/ })).toHaveAttribute("aria-pressed", "false");
      });
    }
  });
});
