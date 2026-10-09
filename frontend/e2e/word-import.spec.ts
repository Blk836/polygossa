import { expect, test, type Page, type Route } from "@playwright/test";
import type { WordImportJob } from "../lib/word-import";

const job = (over: Partial<WordImportJob>): WordImportJob => ({
  id: 9_000_001, source: "lingq", language: "fr", state: "running", found: 0, added: 0, updated: 0, unchanged: 0,
  overLimit: 0, error: null, createdAt: new Date().toISOString(), finishedAt: null, ...over,
});

const panel = (page: Page) => page.getByRole("region", { name: "Import words" });

async function openImport(page: Page) {
  await page.goto("/vocabulary");
  await page.getByRole("button", { name: "Import words" }).click();
}

async function stubList(page: Page, lists: WordImportJob[][]) {
  await page.route("**/api/word-imports", (route: Route) =>
    route.request().method() === "GET" ? route.fulfill({ json: lists.length > 1 ? lists.shift() : lists[0] }) : route.fallback());
}

test("a Readlang export is imported in the background and its result shown", async ({ page }) => {
  const stamp = Date.now();
  const terms = [`rlmaison${stamp}`, `rlchat${stamp}`];
  try {
    await openImport(page);
    const before = (await (await page.request.get("/api/word-imports")).json()) as WordImportJob[];
    const lastId = Math.max(0, ...before.map((j) => j.id));
    await panel(page).getByRole("button", { name: "Readlang" }).click();
    await panel(page).getByLabel("Readlang word list").setInputFiles({
      name: "words.csv", mimeType: "text/csv",
      buffer: Buffer.from(`Word,Translation,Context\n${terms[0]},house,Une maison\n${terms[1]},cat,Le chat\n`),
    });
    await panel(page).getByLabel("Language").selectOption("fr");
    await panel(page).getByRole("button", { name: "Import from Readlang" }).click();
    await expect.poll(async () => {
      const [newest] = (await (await page.request.get("/api/word-imports")).json()) as WordImportJob[];
      return newest && newest.id > lastId ? newest.state : "not started";
    }, { timeout: 15_000 }).toBe("done");
    const latest = panel(page).getByTestId("word-import").first();
    await expect(latest).toContainText("Readlang · French · Done");
    await expect(latest).toContainText("2 found · 2 added");
    const words = await (await page.request.get(`/api/vocabulary?language=fr&q=rlmaison${stamp}`)).json();
    expect(words.items[0].definition).toBe("house");
  } finally {
    for (const term of terms) await page.request.delete(`/api/vocabulary/by-term?language=fr&term=${term}`);
  }
});

test("a LingQ import sends the key once, clears it, and shows progress until done", async ({ page }) => {
  let sent: unknown = null;
  let polls = 0;
  await page.route("**/api/word-imports/lingq", async (route) => {
    sent = route.request().postDataJSON();
    await route.fulfill({ status: 202, json: job({ state: "queued" }) });
  });
  await page.route("**/api/word-imports", (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    if (sent === null) return route.fulfill({ json: [] });
    polls++;
    return route.fulfill({ json: [polls <= 1 ? job({ found: 200, added: 200 }) : job({ state: "done", found: 450, added: 450 })] });
  });
  await openImport(page);
  await panel(page).getByLabel("LingQ API key").fill("abc123secret");
  await panel(page).getByLabel("Language").selectOption("fr");
  await panel(page).getByRole("button", { name: "Import from LingQ" }).click();
  await expect(panel(page).getByTestId("word-import").first()).toContainText("LingQ · French · Importing…");
  await expect(panel(page).getByTestId("word-import").first()).toContainText("LingQ · French · Done", { timeout: 10_000 });
  await expect(panel(page).getByTestId("word-import").first()).toContainText("450 found · 450 added");
  expect(sent).toEqual({ apiKey: "abc123secret", language: "fr" });
  await expect(panel(page).getByLabel("LingQ API key")).toHaveValue("");
  await expect(page.getByText("abc123secret")).toHaveCount(0);
});

test("without a language, LingQ imports every language", async ({ page }) => {
  let sent: unknown = null;
  await page.route("**/api/word-imports/lingq", async (route) => {
    sent = route.request().postDataJSON();
    await route.fulfill({ status: 202, json: job({ language: null, state: "done" }) });
  });
  await stubList(page, [[job({ language: null, state: "done", found: 3, added: 3 })]]);
  await openImport(page);
  await panel(page).getByLabel("Language").selectOption("");
  await panel(page).getByLabel("LingQ API key").fill("abc123");
  await panel(page).getByRole("button", { name: "Import from LingQ" }).click();
  expect(sent).toEqual({ apiKey: "abc123", language: null });
  await expect(panel(page).getByTestId("word-import").first()).toContainText("LingQ · All languages · Done");
});

test("a rejected start shows the error", async ({ page }) => {
  await page.route("**/api/word-imports/lingq", (route) =>
    route.fulfill({ status: 400, json: { code: "bad_request", message: "That doesn't look like a LingQ API key." } }));
  await openImport(page);
  await panel(page).getByLabel("LingQ API key").fill("bad key");
  await panel(page).getByRole("button", { name: "Import from LingQ" }).click();
  await expect(panel(page)).toContainText("That doesn't look like a LingQ API key.");
});

test("a failed import says why, and words over the plan limit link to the plans", async ({ page }) => {
  await stubList(page, [[
    job({ id: 2, state: "failed", error: "LingQ didn't accept this API key. Copy it again from lingq.com/accounts/apikey." }),
    job({ id: 1, source: "readlang", state: "done", found: 30, added: 10, overLimit: 20 }),
  ]]);
  await openImport(page);
  await panel(page).getByLabel("Language").selectOption("fr");
  const rows = panel(page).getByTestId("word-import");
  await expect(rows).toHaveCount(1);
  await expect(rows.nth(0)).toContainText("LingQ didn't accept this API key.");
  await panel(page).getByRole("button", { name: "Readlang" }).click();
  await expect(rows).toHaveCount(1);
  await expect(rows.nth(0)).toContainText("20 over the Free plan's limit");
  await expect(rows.nth(0).getByRole("link", { name: "See plans" })).toHaveAttribute("href", "/settings/subscription");
});

test("while an import runs, starting another is disabled", async ({ page }) => {
  await stubList(page, [[job({ state: "running", found: 10, added: 10 })]]);
  await openImport(page);
  await expect(panel(page).getByRole("button", { name: "Importing…" })).toBeDisabled();
  await expect(panel(page)).toContainText("you can leave this page, it keeps going");
});
