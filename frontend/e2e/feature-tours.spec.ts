import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import type { Me } from "../lib/types";

// feature-tours.feature: a short tour the first time a new account opens each main page.
// Each test signs up an account of its own: the shared test account has tours off (like accounts from before tours).

async function newcomer(browser: Browser, viewport = { width: 1280, height: 900 }): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({ baseURL: test.info().project.use.baseURL, viewport });
  const email = `tour-${Date.now()}-${Math.random().toString(36).slice(2)}@test.co`;
  const res = await context.request.post("/api/auth/signup", { data: { email, password: "password123", displayName: "Newcomer" } });
  expect(res.ok(), await res.text()).toBe(true);
  return { context, page: await context.newPage() };
}

async function me(page: Page): Promise<Me> {
  return (await (await page.request.get("/api/me")).json()) as Me;
}

/** New accounts are on Free; Review and Write are part of Pro. */
async function goPro(page: Page) {
  expect((await page.request.post("/api/me/plan", { data: { tier: "PRO" } })).ok()).toBe(true);
}

const tip = (page: Page) => page.getByTestId("tour");
const highlight = (page: Page) => page.getByTestId("tour-highlight");

test.describe("feature tours", () => {
  test("a new account gets the Library tour once, pointing at each control in turn", async ({ browser }) => {
    const { context, page } = await newcomer(browser);
    await page.goto("/library");
    await expect(page.getByRole("dialog", { name: "Add something to read" })).toBeVisible();
    await expect(tip(page)).toContainText("1 of 3");

    // The highlight sits on the control the tip is about.
    const importBox = (await page.locator('[data-tour="import"]').boundingBox())!;
    const ring = (await highlight(page).boundingBox())!;
    expect(Math.abs(ring.x + ring.width / 2 - (importBox.x + importBox.width / 2))).toBeLessThan(3);
    expect(Math.abs(ring.y + ring.height / 2 - (importBox.y + importBox.height / 2))).toBeLessThan(3);

    await tip(page).getByRole("button", { name: "Next" }).click();
    await expect(page.getByRole("dialog", { name: "Or pick from Explore" })).toBeVisible();
    await expect(tip(page)).toContainText("2 of 3");
    await tip(page).getByRole("button", { name: "Next" }).click();
    await expect(page.getByRole("dialog", { name: "Your learning language" })).toBeVisible();
    await expect(tip(page)).toContainText("3 of 3");
    await expect(tip(page).getByRole("button", { name: "Next" })).toHaveCount(0);
    await tip(page).getByRole("button", { name: "Done" }).click();
    await expect(tip(page)).toHaveCount(0);

    await expect.poll(async () => (await me(page)).tours.seen).toEqual(["library"]);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Library" })).toBeVisible();
    await expect(highlight(page)).toHaveCount(0);
    await expect(tip(page)).toHaveCount(0);
    await context.close();
  });

  test("the page underneath stays usable while a tip is showing", async ({ browser }) => {
    const { context, page } = await newcomer(browser);
    await page.goto("/library");
    await expect(page.getByRole("dialog", { name: "Add something to read" })).toBeVisible();
    await page.locator('[data-tour="import"]').click();
    await expect(page).toHaveURL(/\/import/);
    // A new page for the first time: its own tour.
    await expect(page.getByRole("dialog", { name: "Choose where it comes from" })).toBeVisible();
    await page.getByLabel("Title").fill("Typed while the tip is up");
    await expect(page.getByLabel("Title")).toHaveValue("Typed while the tip is up");
    await context.close();
  });

  test("closing one tour leaves the others; Skip all tours stops them everywhere", async ({ browser }) => {
    const { context, page } = await newcomer(browser);
    await page.goto("/vocabulary");
    await expect(page.getByRole("dialog", { name: "Every word you've saved" })).toBeVisible();
    await tip(page).getByRole("button", { name: "Close tour" }).click();
    await expect(tip(page)).toHaveCount(0);

    await page.goto("/dashboard");
    await expect(page.getByRole("dialog", { name: "Keep your streak" })).toBeVisible();
    await tip(page).getByRole("button", { name: "Next" }).focus();
    await page.keyboard.press("Escape");
    await expect(tip(page)).toHaveCount(0);

    await page.goto("/library");
    await expect(page.getByRole("dialog", { name: "Add something to read" })).toBeVisible();
    await tip(page).getByRole("button", { name: "Skip all tours" }).click();
    await expect(tip(page)).toHaveCount(0);
    await expect.poll(async () => (await me(page)).tours.on).toBe(false);

    for (const path of ["/community", "/forum", "/playlists"]) {
      await page.goto(path);
      await expect(page.locator("h1").first()).toBeVisible();
      await expect(tip(page)).toHaveCount(0);
    }
    const seen = (await me(page)).tours.seen;
    expect(seen).toEqual(expect.arrayContaining(["words", "progress"]));
    await context.close();
  });

  test("Settings › Profile turns tours off and shows them again", async ({ browser }) => {
    const { context, page } = await newcomer(browser);
    await page.goto("/forum");
    await tip(page).getByRole("button", { name: "Done" }).click();
    await expect(tip(page)).toHaveCount(0);

    await page.goto("/settings");
    // Settings has no tour of its own.
    await expect(page.getByRole("heading", { name: "Feature tours" })).toBeVisible();
    await expect(tip(page)).toHaveCount(0);
    await page.getByRole("button", { name: "Turn off tours" }).click();
    await expect(page.getByText("Tours are off.")).toBeVisible();
    await page.goto("/library");
    await expect(page.getByRole("heading", { name: "Library" })).toBeVisible();
    await expect(tip(page)).toHaveCount(0);

    await page.goto("/settings");
    await page.getByRole("button", { name: "Show tours again" }).click();
    await expect(page.getByText("Each page shows its tour again on your next visit.")).toBeVisible();
    await page.goto("/forum");
    await expect(page.getByRole("dialog", { name: "Talk to us" })).toBeVisible();
    await context.close();
  });

  test("the reader's tour points at the text, then the page buttons", async ({ browser }) => {
    const { context, page } = await newcomer(browser);
    const created = await page.request.post("/api/texts", { data: { title: "Tour text", language: "es", content: "El gato come pan. El perro duerme." } });
    expect(created.ok(), await created.text()).toBe(true);
    const { id } = (await created.json()) as { id: number };
    await page.goto(`/read/${id}`);
    await expect(page.getByRole("dialog", { name: "Click any word" })).toBeVisible();
    const text = (await page.locator('[data-tour="reader-text"]').boundingBox())!;
    const ring = (await highlight(page).boundingBox())!;
    expect(Math.abs(ring.y + ring.height / 2 - (text.y + text.height / 2))).toBeLessThan(3);
    await tip(page).getByRole("button", { name: "Next" }).click();
    await tip(page).getByRole("button", { name: "Next" }).click();
    await expect(page.getByRole("dialog", { name: "Turn the page when you're done" })).toBeVisible();
    // One page: the tip points at Finish lesson instead of the page buttons.
    await expect(highlight(page)).toBeVisible();
    await page.request.delete(`/api/texts/${id}`);
    await context.close();
  });

  test("a tip about the whole page sits at the bottom of the screen with no highlight", async ({ browser }) => {
    const { context, page } = await newcomer(browser);
    await goPro(page); // Review is part of Pro: on Free it has no tour (see below)
    await page.goto("/review");
    await expect(page.getByRole("dialog", { name: "Review before you forget" })).toBeVisible();
    await expect(tip(page)).toContainText("1 of 1");
    await expect(highlight(page)).toHaveCount(0);
    const card = (await tip(page).boundingBox())!;
    expect(card.y + card.height).toBeGreaterThan(900 - 60);
    await context.close();
  });

  test("on a phone, the tip fits the screen and stays above the tab bar", async ({ browser }) => {
    const { context, page } = await newcomer(browser, { width: 390, height: 800 });
    await goPro(page);
    await page.goto("/review");
    await expect(page.getByRole("dialog", { name: "Review before you forget" })).toBeVisible();
    const card = (await tip(page).boundingBox())!;
    expect(card.x).toBeGreaterThanOrEqual(0);
    expect(card.x + card.width).toBeLessThanOrEqual(390);
    const tabBar = (await page.getByRole("navigation", { name: "Main" }).last().boundingBox())!;
    expect(card.y + card.height).toBeLessThanOrEqual(tabBar.y);
    await context.close();
  });

  test("a locked page keeps its tour until it opens up: Review and Write on Free, Write without a language", async ({ browser }) => {
    const { context, page } = await newcomer(browser);
    await page.goto("/review");
    await expect(page.getByText("Spaced-repetition review is part of Pro.")).toBeVisible();
    await expect(tip(page)).toHaveCount(0);
    await page.goto("/writing");
    await expect(page.getByText("Timed writing tests with AI grading are part of Pro.")).toBeVisible();
    await expect(tip(page)).toHaveCount(0);
    expect((await me(page)).tours.seen).toEqual([]);

    await goPro(page);
    await page.goto("/writing");
    await expect(page.getByText("Choose a language first")).toBeVisible();
    await expect(tip(page)).toHaveCount(0);
    await page.goto("/review");
    await expect(page.getByRole("dialog", { name: "Review before you forget" })).toBeVisible();

    expect((await page.request.patch("/api/me", { data: { targetLanguage: "es" } })).ok()).toBe(true);
    await page.goto("/writing");
    await expect(page.getByRole("dialog", { name: "Test your writing" })).toBeVisible();
    await context.close();
  });

  test("when saving fails, the card still goes away for now", async ({ browser }) => {
    const { context, page } = await newcomer(browser);
    await page.route("**/api/me/tours/**", (route) => route.abort());
    await page.goto("/forum");
    await expect(page.getByRole("dialog", { name: "Talk to us" })).toBeVisible();
    await tip(page).getByRole("button", { name: "Done" }).click();
    await expect(tip(page)).toHaveCount(0);
    expect((await me(page)).tours.seen).toEqual([]);
    await context.close();
  });

  test("accounts with tours off, like the test account, see none", async ({ page }) => {
    for (const path of ["/library", "/vocabulary", "/forum"]) {
      await page.goto(path);
      await expect(page.locator("h1").first()).toBeVisible();
      await expect(tip(page)).toHaveCount(0);
    }
  });

  test("onboarding has no tour", async ({ browser }) => {
    const { context, page } = await newcomer(browser);
    await page.goto("/onboarding");
    await expect(page.locator("h1").first()).toBeVisible();
    await expect(tip(page)).toHaveCount(0);
    await context.close();
  });
});
