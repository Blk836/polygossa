import { expect, test, type Page } from "@playwright/test";

// The sign-in and sign-up splash (auth-splash.feature): a page of text that learns its words one by one beside the
// form. Its root exposes the language shown (data-language), the step of its timeline (data-step) and whether it is
// ticking (data-running), so tests can follow the animation without screenshots. The timeline is lib/splash.ts.
const splash = (page: Page) => page.getByTestId("auth-splash");
const words = (page: Page) => splash(page).getByTestId("splash-words");
const counter = (page: Page) => splash(page).getByTestId("splash-known");
const pauseButton = (page: Page) => splash(page).getByRole("button", { name: /animation/ });

async function knownCount(page: Page) {
  return Number(((await counter(page).textContent()) ?? "").split("/")[0]);
}

test.describe("auth splash", () => {
  for (const [path, heading, copy] of [
    ["/login", "Welcome back", "Pick up where you left off"],
    ["/signup", "Start reading in two minutes", "Every word you learn makes the next page easier"],
  ]) {
    test(`${path} shows the splash beside the form`, async ({ page }) => {
      await page.goto(path);
      expect(new URL(page.url()).pathname).toBe(path); // auto-login no longer skips the page
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
      await expect(page.getByLabel("Email")).toBeVisible();
      await expect(splash(page)).toContainText(copy);
      await expect(words(page).locator(".w-new").first()).toBeVisible();
    });
  }

  test("wide screens put the splash and the form side by side", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/login");
    const panel = (await splash(page).boundingBox())!;
    const form = (await page.getByLabel("Email").boundingBox())!;
    expect(panel.x + panel.width).toBeLessThanOrEqual(form.x);
    expect(panel.width).toBeGreaterThanOrEqual(1280 * 0.4);
    expect(panel.height).toBeGreaterThanOrEqual(800 - 1);
  });

  test("phones stack a short band above the form, with no sideways scroll", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/login");
    const panel = (await splash(page).boundingBox())!;
    const email = (await page.getByLabel("Email").boundingBox())!;
    expect(panel.y + panel.height).toBeLessThanOrEqual(email.y);
    expect(email.y + email.height).toBeLessThanOrEqual(844);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });

  test("learns one word at a time: gloss, learning, then known, counting up", async ({ page }) => {
    await page.goto("/signup?lang=fr");
    await expect(splash(page)).toHaveAttribute("data-running", "true");
    await expect(splash(page)).toHaveAttribute("data-language", "fr");
    await expect(splash(page)).toContainText("Français");
    // The first new French word is "dimanche"; the gloss shows its meaning, then it turns learning.
    await expect(splash(page).getByTestId("splash-gloss")).toHaveText(/dimanche\s*—\s*Sunday/);
    const dimanche = words(page).getByText("dimanche", { exact: true });
    await expect(dimanche).toHaveClass(/w-learning/, { timeout: 4000 });
    const before = await knownCount(page);
    await expect(dimanche).toHaveClass(/w-known/, { timeout: 4000 });
    await expect.poll(() => knownCount(page)).toBe(before + 1);
    await expect(splash(page).getByTestId("splash-gloss")).toHaveText(/allons\s*—\s*go/);
  });

  test("turns the page to the next language once every word is known, wrapping round", async ({ page }) => {
    test.setTimeout(45_000);
    await page.goto("/signup?lang=pt"); // the last language: the next is the first, English
    await expect(splash(page)).toHaveAttribute("data-language", "pt");
    const total = (await counter(page).textContent())!.split("/")[1];
    await expect(counter(page)).toHaveText(`${total}/${total}`, { timeout: 15_000 });
    await expect(words(page).locator(".w-new, .w-learning")).toHaveCount(0);
    await expect(splash(page)).toHaveAttribute("data-language", "en", { timeout: 8000 });
    await expect(splash(page)).toContainText("English");
    await expect(words(page).locator(".w-new").first()).toBeVisible();
  });

  test("starts in English when sign-up has no language, or an unknown or paused one", async ({ page }) => {
    for (const path of ["/signup", "/signup?lang=xx", "/signup?lang=ja", "/login"]) {
      await page.goto(path);
      await expect(splash(page)).toHaveAttribute("data-language", "en");
    }
  });

  test("pauses and resumes", async ({ page }) => {
    await page.goto("/login");
    await expect(pauseButton(page)).toHaveText("Pause animation");
    await pauseButton(page).click();
    await expect(pauseButton(page)).toHaveText("Play animation");
    await expect(splash(page)).toHaveAttribute("data-running", "false");
    const step = await splash(page).getAttribute("data-step");
    await page.waitForTimeout(2500);
    await expect(splash(page)).toHaveAttribute("data-step", step!);
    await pauseButton(page).click();
    await expect(pauseButton(page)).toHaveText("Pause animation");
    await expect(splash(page)).not.toHaveAttribute("data-step", step!, { timeout: 4000 });
  });

  test("reduced motion shows a still page with no pause button", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/login");
    await expect(words(page).locator(".w-new").first()).toBeVisible();
    await expect(splash(page)).toHaveAttribute("data-running", "false");
    await expect(pauseButton(page)).toHaveCount(0);
    await expect(splash(page).getByTestId("splash-gloss")).toHaveCount(0);
    await page.waitForTimeout(2500);
    await expect(splash(page)).toHaveAttribute("data-step", "0");
  });

  test("stays out of the way: decorative sentence, focus goes to the form", async ({ page }) => {
    await page.goto("/login");
    await expect(words(page)).toHaveAttribute("aria-hidden", "true");
    await expect(splash(page).getByTestId("splash-greetings")).toHaveAttribute("aria-hidden", "true");
    // Tab order: the splash's pause button, the logo, then straight into the form.
    await page.keyboard.press("Tab");
    await expect(pauseButton(page)).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: /home/ })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByLabel("Email")).toBeFocused();
  });
});

test.describe("auth pages and auto-login", () => {
  test("app pages still sign in automatically", async ({ page }) => {
    await page.goto("/library");
    await expect(page).toHaveURL(/\/library$/);
  });

  test("a signed-in visitor opening /login or /signup is sent to the library", async ({ page }) => {
    await page.goto("/library"); // auto-login sets the session cookie
    for (const path of ["/login", "/signup"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/library$/);
    }
  });
});
