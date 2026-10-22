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

async function save(page: Page, created: Created, term: string, kind = "word") {
  const res = await page.request.post("/api/vocabulary", { data: { language: created.language, term, kind, status: "learning" } });
  expect(res.ok(), await res.text()).toBe(true);
}

async function searchFor(page: Page, q: string) {
  await search(page).fill(q);
  await search(page).press("Enter");
}

test("Words shows how often I've met each word and sorts by it, with no export picker", async ({ page }) => {
  let created: Created | null = null;
  try {
    created = await createTextWith(page, (w) => `${w(1)} ${w(2)} ${w(1)}. ${w(1)} ${w(2)} ${w(3)}. ${w(4)} ${w(1)}.`);
    const [often, twice, once, never] = [created.word(1), created.word(2), created.word(3), `${created.prefix}nunca`];
    await readThrough(page, created);
    for (const term of [never, once, often, twice]) await save(page, created, term);

    await page.goto("/vocabulary");
    await searchFor(page, created.prefix);

    await expect(row(page, often).getByTestId("times-met")).toHaveText(/^Met 4 times · 1 in [\d,]+ words$/);
    await expect(row(page, once).getByTestId("times-met")).toHaveText(/^Met once · 1 in [\d,]+ words$/);
    await expect(row(page, never).getByTestId("times-met")).toHaveText("Not met yet");

    await filter(page, "Sort").selectOption("met");
    await expect(page.getByRole("listitem").locator(".font-reading.text-lg")).toHaveText([often, twice, once, never]);
    await expect(page.getByRole("combobox", { name: "Words to export" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Export to Anki" })).not.toHaveAttribute("href", /limit=/);
  } finally {
    await cleanUp(page, created);
  }
});

test("Phrases show how often I've met them and sort by it", async ({ page }) => {
  let created: Created | null = null;
  try {
    created = await createTextWith(page, (w) => `${w(1)} ${w(2)} ${w(3)}. ${w(1)} ${w(2)} ${w(4)}. ${w(3)} ${w(4)}.`);
    const twice = `${created.word(1)} ${created.word(2)}`;
    const once = `${created.word(3)} ${created.word(4)}`;
    const never = `${created.word(4)} ${created.word(1)}`;
    await readThrough(page, created);
    for (const term of [never, once, twice]) await save(page, created, term, "phrase");

    await page.goto("/vocabulary");
    await section(page).getByRole("button", { name: "Phrases", exact: true }).click();
    await searchFor(page, created.prefix);

    await expect(row(page, twice).getByTestId("times-met")).toHaveText("Met 2 times");
    await expect(row(page, once).getByTestId("times-met")).toHaveText("Met once");
    await expect(row(page, never).getByTestId("times-met")).toHaveText("Not met yet");

    await filter(page, "Sort").selectOption("met");
    await expect(page.getByRole("listitem").locator(".font-reading.text-lg")).toHaveText([twice, once, never]);
  } finally {
    await cleanUp(page, created);
  }
});
