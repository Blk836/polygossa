import { expect, test, type Page } from "@playwright/test";
import type { NotWordsPlan, NotWordsReport } from "../lib/admin";

const PLAN: NotWordsPlan = { language: "fr", texts: 231, words: 31_600, calls: 316, estimatedTokens: 380_000, estimatedCost: 1.71 };
const AFTER: NotWordsPlan = { ...PLAN, words: 31_300, calls: 313 };
const REPORT: NotWordsReport = {
  language: "fr", calls: 3, tokensIn: 2100, tokensOut: 540, cost: 0.0085, notWords: ["imé", "inquièteent", "until"],
  wordsLeft: 31_300, textsUpdated: 4, wordsIgnored: 2, stopped: "calls",
};

async function stub(page: Page): Promise<{ plans: string[]; runs: unknown[] }> {
  const seen = { plans: [] as string[], runs: [] as unknown[] };
  await page.route("**/api/admin/ai?*", (route) => route.fulfill({
    json: { days: 30, prices: { translatePerMillionCharacters: 15, aiInputPerMillionTokens: 0.15, aiOutputPerMillionTokens: 0.6 },
      today: { day: "2026-10-25", systemTokens: 0, ceiling: 500_000 }, jobs: [],
      total: { job: null, system: false, calls: 0, failures: 0, tokensIn: 0, tokensOut: 0, cost: 0 } },
  }));
  await page.route("**/api/admin/not-words**", async (route) => {
    const request = route.request();
    if (request.method() === "POST") {
      seen.runs.push(request.postDataJSON());
      await route.fulfill({ json: REPORT });
    } else {
      seen.plans.push(new URL(request.url()).searchParams.get("language") ?? "");
      await route.fulfill({ json: seen.runs.length ? AFTER : PLAN });
    }
  });
  return seen;
}

async function openPanel(page: Page) {
  await page.goto("/admin?tab=ai");
  const panel = page.getByRole("region", { name: "Not-words cleanup" });
  await expect(panel).toBeVisible();
  return panel;
}

test("a dry run shows the words, calls and most it could cost, and Run waits for it", async ({ page }) => {
  const seen = await stub(page);
  const panel = await openPanel(page);
  await expect(panel.getByRole("button", { name: "Run", exact: true })).toBeDisabled();
  await panel.getByRole("button", { name: "Dry run" }).click();
  await expect(panel.getByTestId("not-words-plan")).toHaveText(
    "31,600 words without a verdict, in 231 texts: 316 AI calls, up to 380,000 tokens, at most $1.71.");
  expect(seen.plans).toEqual(["fr"]);
  expect(seen.runs).toEqual([]);
  await expect(panel.getByRole("button", { name: "Run", exact: true })).toBeEnabled();
});

test("Run sends the limits, shows what it found, and refreshes the plan", async ({ page }) => {
  const seen = await stub(page);
  const panel = await openPanel(page);
  await panel.getByRole("button", { name: "Dry run" }).click();
  await panel.getByLabel("AI calls at most").fill("3");
  await panel.getByLabel("Tokens at most").fill("50000");
  await panel.getByRole("button", { name: "Run", exact: true }).click();
  await expect(panel.getByTestId("not-words-found")).toHaveText("imé, inquièteent, until");
  await expect(panel.getByTestId("not-words-report")).toContainText("Stopped at the call limit.");
  await expect(panel.getByTestId("not-words-report")).toContainText("31,300 words still to check.");
  await expect(panel.getByTestId("not-words-report")).toContainText("4 texts updated · 2 known words moved to Ignored");
  await expect(panel.getByTestId("not-words-plan")).toContainText("31,300 words without a verdict");
  expect(seen.runs).toEqual([{ language: "fr", maxCalls: 3, maxTokens: 50_000 }]);
});
