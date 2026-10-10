import { expect, test, type Page } from "@playwright/test";
import { article, cleanUp, createText, openReader, popupClose, type Created } from "./reader-helpers";

const section = (page: Page) => page.getByRole("group", { name: "Vocabulary section" });
const tab = (page: Page, name: string) => section(page).getByRole("button", { name, exact: true });
const search = (page: Page) => page.getByPlaceholder("Search words or definitions…");

async function save(page: Page, data: Record<string, unknown>): Promise<number> {
  const res = await page.request.post("/api/vocabulary", { data: { language: "es", status: "learning", ...data } });
  expect(res.ok(), await res.text()).toBe(true);
  return (await res.json()).id;
}

async function searchFor(page: Page, q: string) {
  await search(page).fill(q);
  await search(page).press("Enter");
}

test("Practice → Words has a Words tab and a Phrases tab, and no type filter", async ({ page }) => {
  await page.goto("/vocabulary");
  await expect(section(page).getByRole("button")).toHaveText(["Words", "Phrases"]);
  await expect(tab(page, "Words")).toHaveAttribute("aria-pressed", "true");
  await expect(tab(page, "Phrases")).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("combobox", { name: "Type" })).toHaveCount(0);
});

test("words and phrases each have their own tab, and the filters carry across", async ({ page }) => {
  await page.goto("/library");
  const unique = `zqtab${Date.now().toString(36)}`;
  const ids = [
    await save(page, { term: `${unique}casa` }),
    await save(page, { term: `${unique}por favor`, kind: "phrase" }),
  ];
  try {
    await page.goto("/vocabulary");
    await searchFor(page, unique);
    await expect(page.getByText(`${unique}casa`, { exact: true })).toBeVisible();
    await expect(page.getByText(`${unique}por favor`, { exact: true })).toHaveCount(0);

    await tab(page, "Phrases").click();
    await expect(tab(page, "Phrases")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText(`${unique}por favor`, { exact: true })).toBeVisible();
    await expect(page.getByText(`${unique}casa`, { exact: true })).toHaveCount(0);

    await page.getByRole("combobox", { name: "Status" }).selectOption("known");
    await page.getByRole("combobox", { name: "Sort" }).selectOption("alpha");
    await expect(page.getByText(`${unique}por favor`, { exact: true })).toHaveCount(0);

    await tab(page, "Words").click();
    await expect(page.getByRole("combobox", { name: "Status" })).toHaveValue("known");
    await expect(page.getByRole("combobox", { name: "Sort" })).toHaveValue("alpha");
    await expect(search(page)).toHaveValue(unique);
    await expect(page.getByText(`${unique}casa`, { exact: true })).toHaveCount(0);
  } finally {
    await page.request.post("/api/vocabulary/delete", { data: { ids } });
  }
});

test("an empty Phrases tab says how to add phrases", async ({ page }) => {
  await page.route("**/api/vocabulary?*kind=phrase*", (route) =>
    route.fulfill({ json: { items: [], total: 0, page: 0, size: 50 } }),
  );
  await page.goto("/vocabulary");
  await tab(page, "Phrases").click();
  await expect(page.getByText("No phrases here yet")).toBeVisible();
  await expect(page.getByText(/select several words.*Save sentence to review/)).toBeVisible();
});

test.describe("saving a sentence from the reader", () => {
  let created: Created | null = null;
  test.afterEach(async ({ page }) => {
    await cleanUp(page, created);
    created = null;
  });

  test("makes it a phrase on the Phrases tab, once however often it is saved", async ({ page }) => {
    created = await createText(page, 20);
    const sentence = Array.from({ length: 10 }, (_, k) => created!.word(k)).join(" ") + ".";
    const saves: Record<string, unknown>[] = [];
    page.on("request", (r) => {
      if (r.url().endsWith("/api/vocabulary") && r.method() === "POST") saves.push(r.postDataJSON());
    });

    await openReader(page, `/read/${created.id}`);
    for (let i = 0; i < 2; i++) {
      await article(page).getByText(created.word(1), { exact: true }).click();
      await page.getByRole("button", { name: "Save sentence to review" }).click();
      await expect(page.getByRole("button", { name: "✓ Sentence saved" })).toBeVisible();
      await popupClose(page).click();
    }
    expect(saves).toHaveLength(2);
    expect(saves[0]).toMatchObject({ language: created.language, term: sentence, kind: "phrase", textId: created.id });

    await page.goto("/vocabulary");
    await tab(page, "Phrases").click();
    await searchFor(page, created.prefix);
    const rows = page.getByRole("listitem").filter({ hasText: sentence });
    await expect(rows).toHaveCount(1);
    await expect(rows.getByRole("link", { name: `Reader check ${created.prefix}` })).toBeVisible();
  });
});

test("a phrase is reviewed as a phrase, its meaning shown on the back", async ({ page }) => {
  const front = "El perro ladra mucho cuando llega el cartero.";
  await page.route("**/api/review/queue*", (route) => route.fulfill({
    json: [{ type: "word", kind: "phrase", id: 1, language: "es", front, definition: "The dog barks a lot when the postman comes.",
      dueAt: "2026-10-10T00:00:00Z", repetitions: 0 }],
  }));
  await page.goto("/review");
  const card = page.locator("[data-tour=review-card]");
  await expect(card.getByText(/^Phrase · 1 left$/)).toBeVisible();
  await expect(card.getByText(front)).toHaveClass(/text-2xl/);
  await card.getByRole("button", { name: /Show answer/ }).click();
  await expect(card.getByText("The dog barks a lot when the postman comes.")).toBeVisible();
});
