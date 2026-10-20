import { expect, test, type Page } from "@playwright/test";

async function addWord(page: Page, data: Record<string, string>) {
  await page.goto("/library");
  const term = `zqenter${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const res = await page.request.post("/api/vocabulary", { data: { language: "es", term, status: "learning", ...data } });
  expect(res.ok()).toBe(true);
  return { term, id: (await res.json()).id as number };
}

async function openRow(page: Page, term: string) {
  await page.goto("/vocabulary");
  await page.getByPlaceholder("Search words or definitions…").fill(term);
  await page.getByPlaceholder("Search words or definitions…").press("Enter");
  return page.getByRole("listitem").filter({ has: page.getByText(term, { exact: true }) });
}

const saved = async (page: Page, id: number) => (await (await page.request.get(`/api/vocabulary/${id}`)).json()) as { definition?: string; meaning?: string };

test("Enter saves a definition", async ({ page }) => {
  const { term, id } = await addWord(page, {});
  try {
    const row = await openRow(page, term);
    await row.getByRole("button", { name: "Add a definition…" }).click();
    await row.getByLabel("Definition").fill("dogs");
    await row.getByLabel("Definition").press("Enter");
    await expect(row.getByLabel("Definition")).toHaveCount(0);
    await expect(row.getByRole("button", { name: "dogs" })).toBeVisible();
    await expect.poll(async () => (await saved(page, id)).definition).toBe("dogs");
    await page.reload();
    const again = await openRow(page, term);
    await expect(again.getByRole("button", { name: "dogs" })).toBeVisible();
  } finally {
    await page.request.delete(`/api/vocabulary/${id}`);
  }
});

test("Enter saves an own-language meaning", async ({ page }) => {
  const { term, id } = await addWord(page, { definition: "dog", meaning: "perro" });
  try {
    const row = await openRow(page, term);
    await row.getByTestId("word-meaning").getByRole("button", { name: /perro/ }).click();
    await row.getByLabel("Meaning").fill("perrito");
    await row.getByLabel("Meaning").press("Enter");
    await expect(row.getByTestId("word-meaning")).toContainText("perrito");
    await expect.poll(async () => (await saved(page, id)).meaning).toBe("perrito");
  } finally {
    await page.request.delete(`/api/vocabulary/${id}`);
  }
});

test("the definition's Save button still saves", async ({ page }) => {
  const { term, id } = await addWord(page, {});
  try {
    const row = await openRow(page, term);
    await row.getByRole("button", { name: "Add a definition…" }).click();
    await row.getByLabel("Definition").fill("cats");
    await row.getByRole("button", { name: "Save", exact: true }).click();
    await expect.poll(async () => (await saved(page, id)).definition).toBe("cats");
  } finally {
    await page.request.delete(`/api/vocabulary/${id}`);
  }
});
