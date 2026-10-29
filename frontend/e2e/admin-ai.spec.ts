import { expect, test, type Page } from "@playwright/test";
import type { AdminAi, AiJobRow } from "../lib/admin";

const PRICES = { aiInputPerMillionTokens: 0.15, aiOutputPerMillionTokens: 0.6 };

function job(name: string | null, extra: Partial<AiJobRow>): AiJobRow {
  return { job: name, system: false, calls: 0, failures: 0, tokensIn: 0, tokensOut: 0, cost: 0, ...extra };
}

const DEFINITIONS = job("DEFINITION", { calls: 1200, failures: 3, tokensIn: 900_000, tokensOut: 300_000, cost: 0.316 });
const TAGGING = job("TOPIC_TAGS", { system: true, calls: 40, failures: 1, tokensIn: 100_000, tokensOut: 20_000, cost: 0.027 });

function report(days: number, jobs: AiJobRow[], systemTokens: number): AdminAi {
  const sum = (key: "calls" | "failures" | "tokensIn" | "tokensOut" | "cost") => jobs.reduce((n, j) => n + j[key], 0);
  return {
    days, prices: PRICES,
    today: { day: new Date().toISOString().slice(0, 10), systemTokens, ceiling: 500_000 },
    jobs,
    total: job(null, { calls: sum("calls"), failures: sum("failures"), tokensIn: sum("tokensIn"), tokensOut: sum("tokensOut"), cost: sum("cost") }),
  };
}

async function stubAi(page: Page, jobs: AiJobRow[], systemTokens: number): Promise<number[]> {
  const asked: number[] = [];
  await page.route("**/api/admin/ai?*", async (route) => {
    const days = Number(new URL(route.request().url()).searchParams.get("days"));
    asked.push(days);
    await route.fulfill({ json: report(days, jobs, systemTokens) });
  });
  return asked;
}

test("the AI tab shows each job's calls, tokens and cost, a total, and today's system tokens", async ({ page }) => {
  const asked = await stubAi(page, [DEFINITIONS, TAGGING], 120_000);
  await page.goto("/admin");
  await page.getByRole("navigation", { name: "Admin pages" }).getByRole("link", { name: "AI" }).click();
  await expect(page).toHaveURL(/\/admin\?tab=ai$/);

  const table = page.getByRole("region", { name: "AI calls per job" });
  const definitions = table.getByRole("row").filter({ hasText: "Word definitions" });
  await expect(definitions).toContainText("Learner");
  await expect(definitions).toContainText("1,200");
  await expect(definitions).toContainText("900,000");
  await expect(definitions).toContainText("300,000");
  await expect(definitions).toContainText("$0.32");
  await expect(table.getByRole("row").filter({ hasText: "Topic tagging" })).toContainText("System");
  const total = table.getByRole("row").filter({ hasText: "Total" });
  await expect(total).toContainText("1,240");
  await expect(total).toContainText("$0.34");

  await expect(page.getByTestId("ai-ceiling")).toContainText("120,000 of 500,000 tokens today (UTC)");
  await expect(page.getByTestId("ai-ceiling")).not.toContainText("paused");
  expect(asked).toContain(30);

  await page.getByRole("radiogroup", { name: "Period" }).getByRole("radio", { name: "90 days" }).click();
  await expect.poll(() => asked).toContain(90);
});

test("once the ceiling is reached the AI tab says system jobs are paused", async ({ page }) => {
  await stubAi(page, [TAGGING], 500_400);
  await page.goto("/admin?tab=ai");
  await expect(page.getByTestId("ai-ceiling")).toContainText("500,400 of 500,000 tokens today (UTC)");
  await expect(page.getByTestId("ai-ceiling")).toContainText("System jobs are paused until midnight UTC.");
});

test("with no AI calls the tab says so, straight from the backend", async ({ page }) => {
  await page.goto("/admin?tab=ai");
  await expect(page.getByText("No AI calls in this period.")).toBeVisible();
  await expect(page.getByRole("region", { name: "AI calls per job" })).toHaveCount(0);
  await expect(page.getByTestId("ai-ceiling")).toContainText("0 of 500,000 tokens today (UTC)");
});
