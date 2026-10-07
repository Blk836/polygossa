import { expect, test } from "@playwright/test";
import { article, cleanUp, createTextWith, openReader, type Created } from "./reader-helpers";

// docs/acceptance/native-language.feature: the setting, and translations into it in the word popup.

test("Settings › Profile picks a native language, saved with the profile", async ({ page }) => {
  await page.goto("/library"); // signs in (a first visit lands on the library)
  const me = await (await page.request.get("/api/me")).json();
  let sent: Record<string, unknown> | null = null;
  // Answered in the browser: the shared test account's settings must not change under other specs.
  await page.route("**/api/me", (route) => {
    if (route.request().method() !== "PATCH") return route.continue();
    sent = route.request().postDataJSON();
    return route.fulfill({ json: { ...me, ...sent } });
  });
  await page.goto("/settings");
  const select = page.getByLabel("Your native language");
  await expect(select).toHaveValue("en");
  await expect(select.locator("option").first()).toHaveText("English");
  await select.selectOption("es");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  expect(sent).toMatchObject({ nativeLanguage: "es" });
});

test.describe("the word popup", () => {
  let created: Created | null = null;
  test.afterEach(async ({ page }) => {
    await cleanUp(page, created);
    created = null;
  });

  test("leads with translations into my language and saves them with the word", async ({ page }) => {
    created = await createTextWith(page, (w) => `${w(1)} ${w(2)}.`);
    const term = created.word(1);
    await page.route("**/api/dictionary?*", (route) =>
      route.fulfill({
        json: {
          term, language: created!.language, found: true, pronunciation: null, lemma: null, source: "Free Dictionary API (Wiktionary)", sourceUrl: null,
          senses: [{ partOfSpeech: "noun", definition: "dog", examples: [] }],
          translations: ["perro", "can"], translationLanguage: "es",
        },
      }),
    );
    const saved: string[] = [];
    page.on("request", (r) => {
      if (r.url().includes("/api/vocabulary") && ["POST", "PUT", "PATCH"].includes(r.method())) saved.push(r.postData() ?? "");
    });
    await openReader(page, `/read/${created.id}`);
    await article(page).getByText(term, { exact: true }).click();
    const line = page.getByTestId("translations");
    await expect(line).toContainText("Spanish");
    await expect(line).toContainText("perro, can");
    await expect(page.getByRole("listitem").filter({ hasText: "dog" })).toBeVisible();
    await expect.poll(() => saved.some((body) => body.includes("perro, can — dog"))).toBe(true);
  });

  test("says when no translation was found", async ({ page }) => {
    created = await createTextWith(page, (w) => `${w(1)} ${w(2)}.`);
    const term = created.word(1);
    await page.route("**/api/dictionary?*", (route) =>
      route.fulfill({
        json: {
          term, language: created!.language, found: true, senses: [{ partOfSpeech: "noun", definition: "dog", examples: [] }],
          translations: [], translationLanguage: "es",
        },
      }),
    );
    await openReader(page, `/read/${created.id}`);
    await article(page).getByText(term, { exact: true }).click();
    await expect(page.getByTestId("translations")).toHaveText("No Spanish translation found");
  });
});
