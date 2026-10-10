import { expect, test } from "@playwright/test";

test("a note and tags are added on the Words page, and a tag filters the list", async ({ page }) => {
  await page.goto("/library");
  const unique = `zqnote${Date.now().toString(36)}`;
  const ids: number[] = [];
  for (const term of [unique, `${unique}b`]) {
    const res = await page.request.post("/api/vocabulary", { data: { language: "es", term, status: "learning", definition: "something" } });
    expect(res.ok()).toBe(true);
    ids.push((await res.json()).id);
  }
  try {
    await page.goto("/vocabulary");
    await page.getByPlaceholder("Search words or definitions…").fill(unique);
    await page.getByPlaceholder("Search words or definitions…").press("Enter");
    const row = page.getByRole("listitem").filter({ has: page.getByText(unique, { exact: true }) });
    await expect(row).toBeVisible();

    await row.getByRole("button", { name: "Add a note or tags" }).click();
    await row.getByLabel("Note").fill("a mnemonic about pears");
    await row.getByLabel("Tags").fill("Animals, pets");
    await row.getByRole("button", { name: "Save note" }).click();
    await expect(row.getByTestId("word-note")).toHaveText("a mnemonic about pears");
    await expect(row.getByRole("button", { name: /^Tag / })).toHaveText(["animals", "pets"]);

    await row.getByRole("button", { name: "Tag animals" }).click();
    await page.getByPlaceholder("Search words or definitions…").fill("");
    await page.getByPlaceholder("Search words or definitions…").press("Enter");
    await expect(page.getByTestId("tag-filter")).toContainText("animals");
    await expect(page.getByText(unique, { exact: true })).toBeVisible();
    await expect(page.getByText(`${unique}b`, { exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Clear tag filter" }).click();
    await expect(page.getByTestId("tag-filter")).toHaveCount(0);
  } finally {
    await page.request.post("/api/vocabulary/delete", { data: { ids } });
  }
});
