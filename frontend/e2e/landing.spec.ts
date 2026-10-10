import { expect, test, type Page } from "@playwright/test";

const SIGNUP = /^\/signup(\?lang=(en|es|fr|de|it|pt))?$/;
const NATIVE = ["English", "Español", "Français", "Deutsch", "Italiano", "Português"];

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

  test("the hero's language picker starts sign-up in each of the 6 languages", async ({ page }) => {
    await page.goto("/");
    const picker = page.getByRole("list", { name: "Languages" }).first();
    await expect(picker.getByRole("link")).toHaveText(NATIVE);
    await expect(picker.getByRole("link", { name: "Français" })).toHaveAttribute("href", "/signup?lang=fr");
    await expect(picker.getByRole("link", { name: "English" })).toHaveAttribute("href", "/signup?lang=en");
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
    await expect(demo(page).getByRole("tab")).toHaveText(NATIVE);
    await demo(page).getByRole("tab", { name: "Deutsch" }).click();
    await expect(demo(page).getByRole("tab", { name: "Deutsch" })).toHaveAttribute("aria-selected", "true");
    await expect(demo(page).getByTestId("demo-text")).toHaveText("Am Wochenende fahren wir mit dem Zug in die Berge.");
    await expect(demo(page).getByTestId("demo-card")).toHaveCount(0);
    await expect(demo(page).getByRole("link", { name: /create a free account/ })).toHaveCount(0);
    await demoWord(page, "Zug").click();
    await expect(demo(page).getByTestId("demo-card")).toContainText("train");
    await expect(demo(page).getByRole("link", { name: /create a free account/ })).toHaveAttribute("href", "/signup?lang=de");
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
    expect(hrefs.length).toBeGreaterThanOrEqual(2 * NATIVE.length + 2);
    for (const href of hrefs) expect(href).toMatch(SIGNUP);
  });

  test("signed-in visitors are offered the library instead of sign-up", async ({ page }) => {
    await page.goto("/library");
    await page.goto("/");
    await expect(page).toHaveURL("/");
    const header = page.getByRole("banner");
    await expect(header.getByRole("link", { name: "Open library" })).toHaveAttribute("href", "/community");
    await expect(header.getByRole("link", { name: "Start free" })).toHaveCount(0);
  });

  test("app pages still auto-sign-in from a fresh session", async ({ page }) => {
    await page.goto("/library");
    await expect(page).toHaveURL(/\/library$/);
  });

  test("the hero badge counts the learnable languages and the demo hint reads as a sentence", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(`${NATIVE.length} languages · free to start`)).toBeVisible();
    await expect(demo(page).getByTestId("demo-hint")).toHaveText("Tap a blue word to see what it means.");
    const gap = await demo(page).getByTestId("demo-hint").evaluate((p) => {
      const blue = p.querySelector(".w")!.getBoundingClientRect();
      const before = p.firstChild!;
      const range = document.createRange();
      range.setStart(before, 0);
      range.setEnd(before, before.textContent!.trimEnd().length);
      return blue.left - range.getBoundingClientRect().right;
    });
    expect(gap).toBeGreaterThan(1);
  });

  test("Pro-only features are labelled and the free path doesn't promise review", async ({ page }) => {
    await page.goto("/");
    const step3 = page.locator("#how li").nth(2);
    await expect(step3).toContainText("as you read");
    await expect(step3).toContainText("Pro");
    await expect(page.locator("#features").getByRole("heading", { name: /Reviews/ })).toContainText("Pro");
    await expect(page.locator("body")).not.toContainText("paying for");
  });

  test("pricing shows the yearly price per month and what Pro adds", async ({ page }) => {
    await page.goto("/");
    const pricing = page.locator("#pricing");
    await expect(pricing).toContainText("€60 a year (€5 a month)");
    await expect(pricing).toContainText("Prices include VAT");
    await expect(pricing.getByRole("listitem").filter({ hasText: "Everything in Free" })).toHaveCount(1);
    await expect(pricing).toContainText("LingQ or Readlang");
    await expect(pricing).toContainText("Recommendations at your level");
  });

  test("the FAQ answers switchers, book readers and phone users", async ({ page }) => {
    await page.goto("/");
    const faq = page.locator("#faq");
    for (const [question, answer] of [
      ["Can I bring my words?", "Words page"],
      ["Can I read books?", "EPUB"],
      ["Is there an app?", "browser"],
      ["Which languages can I learn?", "your own language"],
    ]) {
      await faq.getByText(question).click();
      await expect(faq.locator("details[open]").filter({ hasText: question })).toContainText(answer);
    }
  });

  test("a shared link gets a preview with an absolute image on this site", async ({ page, request }) => {
    await page.goto("/");
    const meta = (key: string) => page.locator(`meta[property="${key}"], meta[name="${key}"]`).first();
    await expect(meta("og:title")).toHaveAttribute("content", /\S/);
    await expect(meta("og:description")).toHaveAttribute("content", /\S/);
    await expect(meta("twitter:card")).toHaveAttribute("content", "summary_large_image");
    const image = await meta("og:image").getAttribute("content");
    expect(image).toMatch(/^https?:\/\/[^/]+\/opengraph-image/);
    const res = await request.get(new URL(image!).pathname + new URL(image!).search, { maxRedirects: 0 });
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("image/png");
  });

  test("on a phone the demo's language tabs all fit", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    const tabs = demo(page).getByRole("tablist");
    expect(await tabs.evaluate((t) => t.scrollWidth - t.clientWidth)).toBeLessThanOrEqual(0);
  });

  test("on a phone nothing overflows and the primary CTA is above the fold", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBe(0);
    await expect(page.getByRole("link", { name: "Start reading free" }).first()).toBeInViewport();
  });
});

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
    expect(patches.length).toBeGreaterThan(0);
    for (const body of patches) expect(body).toMatchObject({ targetLanguage: "de" });
  });

  test.describe("without a usable language", () => {
    for (const path of ["/onboarding", "/onboarding?lang=xx", "/onboarding?lang=ja"]) {
      test(`${path} asks for one`, async ({ page }) => {
        await page.goto(path);
        await expect(page.getByRole("heading", { name: "What are you learning?" })).toBeVisible();
        await expect(page.getByRole("button", { name: /Deutsch/ })).toHaveAttribute("aria-pressed", "false");
      });
    }
  });
});
