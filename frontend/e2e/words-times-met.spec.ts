import { expect, test, type Page } from "@playwright/test";
import { cleanUp, createTextWith, type Created } from "./reader-helpers";

const section = (page: Page) => page.getByRole("group", { name: "Vocabulary section" });
const filter = (page: Page, name: string) => page.locator("[data-tour=words-filters]").getByRole("combobox", { name });
const search = (page: Page) => page.getByPlaceholder("Search words or definitions…");

function row(page: Page, term: string) {
  return page.getByRole("listitem").filter({ has: page.getByText(term, { exact: true }) });
}

async function readThrough(page: Page, created: Created) {
  const detail = await (await page.request.get(`/api/texts/${created.id}`)).json();
  const res = await page.request.post(`/api/texts/${created.id}/progress`, { data: { position: detail.tokens.length - 1 } });
  expect(res.ok(), await res.text()).toBe(true);
}

async function save(page: Page, created: Created, term: string) {
  const res = await page.request.post("/api/vocabulary", { data: { language: created.language, term, status: "learning" } });
  expect(res.ok(), await res.text()).toBe(true);
}

test("Words shows how often I've met each word, sorts by it and exports the top words", async ({ page }) => {
  let created: Created | null = null;
  try {
    created = await createTextWith(page, (w) => `${w(1)} ${w(2)} ${w(1)}. ${w(1)} ${w(2)} ${w(3)}. ${w(4)} ${w(1)}.`);
    const [often, twice, once, never] = [created.word(1), created.word(2), created.word(3), `${created.prefix}nunca`];
    await readThrough(page, created);
    for (const term of [never, once, often, twice]) await save(page, created, term);

    await page.goto("/vocabulary");
    await search(page).fill(created.prefix);
    await search(page).press("Enter");

    await expect(row(page, often).getByTestId("times-met")).toHaveText(/^4× · (\d+(\.\d+)?|<0\.01)%$/);
    await expect(row(page, twice).getByTestId("times-met")).toHaveText(/^2× · /);
    await expect(row(page, never).getByTestId("times-met")).toHaveText("Not met yet");

    await expect(page.getByRole("combobox", { name: "Words to export" })).toHaveCount(0);
    await filter(page, "Sort").selectOption("met");
    const terms = page.getByRole("listitem").locator(".font-reading.text-lg");
    await expect(terms).toHaveText([often, twice, once, never]);

    await page.getByRole("combobox", { name: "Words to export" }).selectOption("100");
    const anki = page.getByRole("link", { name: "Export to Anki" });
    await expect(anki).toHaveAttribute("href", /sort=met&limit=100$/);
    await expect(page.getByRole("link", { name: "Export CSV" })).toHaveAttribute("href", /sort=met&limit=100$/);

    await section(page).getByRole("button", { name: "Phrases", exact: true }).click();
    await expect(filter(page, "Sort")).toHaveValue("recent");
    await expect(filter(page, "Sort").locator("option[value=met]")).toHaveCount(0);
  } finally {
    await cleanUp(page, created);
  }
});
