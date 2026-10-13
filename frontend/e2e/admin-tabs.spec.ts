import { expect, test, type Page } from "@playwright/test";
import type { AdminTranslations, TranslationRow } from "../lib/admin";

const tabs = (page: Page) => page.getByRole("navigation", { name: "Admin pages" });

const NO_LAYERS = { aiStored: 0, aiNew: 0, community: 0, machineStored: 0, machineNew: 0, none: 0 };

function row(source: string | null, target: string | null, extra: Partial<TranslationRow>): TranslationRow {
  return {
    source, target, lookups: 0, layers: NO_LAYERS, hitRate: null, translateCalls: 0, translateCharacters: 0,
    translateFailures: 0, translateCapped: 0, aiCalls: 0, aiTokensIn: 0, aiTokensOut: 0, aiFailures: 0, cost: 0,
    costPer1000Lookups: null, stored: { machineWords: 0, machineNoUse: 0, sentenceMeanings: 0, communityWords: 0 }, ...extra,
  };
}

const FR_EN = row("fr", "en", {
  lookups: 1000, layers: { aiStored: 300, aiNew: 100, community: 120, machineStored: 200, machineNew: 250, none: 30 },
  hitRate: 0.62, translateCalls: 260, translateCharacters: 200_000, translateFailures: 2, translateCapped: 1,
  aiCalls: 101, aiTokensIn: 1_000_000, aiTokensOut: 100_000, aiFailures: 1, cost: 3.21, costPer1000Lookups: 3.21,
  stored: { machineWords: 4321, machineNoUse: 87, sentenceMeanings: 950, communityWords: 64 },
});

function report(days: number, pairs: TranslationRow[]): AdminTranslations {
  const today = new Date();
  return {
    days,
    prices: { translatePerMillionCharacters: 15, aiInputPerMillionTokens: 0.15, aiOutputPerMillionTokens: 0.6 },
    month: { month: today.toISOString().slice(0, 7), characters: 12_000, cap: 1_333_333 },
    pairs,
    total: row(null, null, pairs[0] ? { ...pairs[0], source: null, target: null } : {}),
    trend: Array.from({ length: days }, (_, i) => ({
      day: new Date(today.getTime() - (days - 1 - i) * 86_400_000).toISOString().slice(0, 10),
      layers: NO_LAYERS, cost: 0,
    })),
  };
}

async function stubTranslations(page: Page, pairs: TranslationRow[]): Promise<number[]> {
  const asked: number[] = [];
  await page.route("**/api/admin/translations?*", async (route) => {
    const days = Number(new URL(route.request().url()).searchParams.get("days"));
    asked.push(days);
    await route.fulfill({ json: report(days, pairs) });
  });
  return asked;
}

test("the admin page opens on Overview, and each tab keeps its own address", async ({ page }) => {
  await stubTranslations(page, [FR_EN]);
  await page.goto("/admin");
  await expect(tabs(page).getByRole("link")).toHaveText(["Overview", "Users", "Translations", "Log"]);
  await expect(tabs(page).locator("[aria-current=page]")).toHaveText("Overview");
  await expect(page.getByTestId("admin-tiles")).toBeVisible();

  await tabs(page).getByRole("link", { name: "Users" }).click();
  await expect(page).toHaveURL(/\/admin\?tab=users$/);
  await expect(page.getByPlaceholder("Search by email or name")).toBeVisible();
  await expect(page.getByTestId("admin-tiles")).toHaveCount(0);

  await tabs(page).getByRole("link", { name: "Log" }).click();
  await expect(page).toHaveURL(/\/admin\?tab=log$/);
  await expect(page.getByRole("region", { name: "Recent actions" })).toBeVisible();
  await expect(page.getByPlaceholder("Search by email or name")).toHaveCount(0);

  await tabs(page).getByRole("link", { name: "Translations" }).click();
  await expect(page).toHaveURL(/\/admin\?tab=translations$/);
  await expect(page.getByRole("region", { name: "Lookups per language pair" })).toBeVisible();

  await page.reload();
  await expect(tabs(page).locator("[aria-current=page]")).toHaveText("Translations");
  await expect(page.getByRole("region", { name: "Lookups per language pair" })).toBeVisible();
});

test("an unknown tab shows Overview", async ({ page }) => {
  await page.goto("/admin?tab=nonsense");
  await expect(tabs(page).locator("[aria-current=page]")).toHaveText("Overview");
  await expect(page.getByTestId("admin-tiles")).toBeVisible();
});

test("the Translations tab shows a pair's numbers, a total, the cap and the trend", async ({ page }) => {
  const asked = await stubTranslations(page, [FR_EN]);
  await page.goto("/admin?tab=translations");

  const lookups = page.getByRole("region", { name: "Lookups per language pair" });
  const french = lookups.getByRole("row").filter({ hasText: "French → English" });
  await expect(french).toContainText("1,000");
  await expect(french).toContainText("62%");
  await expect(french).toContainText("12%");
  await expect(lookups.getByRole("row").filter({ hasText: "Total" })).toContainText("1,000");

  const costs = page.getByRole("region", { name: "Calls and cost per language pair" });
  const frenchCost = costs.getByRole("row").filter({ hasText: "French → English" });
  await expect(frenchCost).toContainText("200,000");
  await expect(frenchCost).toContainText("1,000,000");
  await expect(frenchCost).toContainText("$3.21");

  const stored = page.getByRole("region", { name: "Stored so far" });
  await expect(stored.getByRole("row").filter({ hasText: "French → English" })).toContainText("4,321");
  await expect(stored.getByRole("row").filter({ hasText: "French → English" })).toContainText("87");

  await expect(page.getByTestId("translation-month")).toContainText("12,000 of 1,333,333 characters");
  await expect(page.getByRole("img", { name: "Lookups answered by the community" })).toBeVisible();
  await expect(page.getByRole("img", { name: /Estimated cost/ })).toBeVisible();
  expect(asked).toContain(30);

  await page.getByRole("radiogroup", { name: "Period" }).getByRole("radio", { name: "7 days" }).click();
  await expect.poll(() => asked).toContain(7);
  await expect(page.getByRole("img", { name: "Lookups answered by the community" })).toBeVisible();
});

test("a period without lookups says so and still shows the cap and what is stored", async ({ page }) => {
  await stubTranslations(page, [row("fr", "en", { stored: { machineWords: 12, machineNoUse: 1, sentenceMeanings: 3, communityWords: 0 } })]);
  await page.goto("/admin?tab=translations");
  await expect(page.getByText("No lookups were counted in this period.")).toBeVisible();
  await expect(page.getByTestId("translation-month")).toContainText("12,000 of 1,333,333 characters");
  await expect(page.getByRole("region", { name: "Stored so far" }).getByRole("row").filter({ hasText: "French → English" })).toContainText("12");
  await expect(page.getByRole("region", { name: "Calls and cost per language pair" }).getByRole("row").filter({ hasText: "French → English" })).toContainText("—");
});
