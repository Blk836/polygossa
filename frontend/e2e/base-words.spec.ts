import { expect, test, type Browser, type Page } from "@playwright/test";
import { signUp, type Person } from "./photo-helpers";
import { article, createTextWith, openReader, TALL, type Created } from "./reader-helpers";

test.use({ viewport: TALL });

const known = (page: Page) => page.getByRole("banner").getByTestId("known-words");
const honeyJar = (page: Page) => page.getByRole("radiogroup", { name: "Honey jar" });
const people: Person[] = [];

test.afterEach(async () => {
  await Promise.all(people.splice(0).map((p) => p.context.close()));
});

async function learner(browser: Browser, name = "Bee learner"): Promise<Person> {
  const person = await signUp(browser, name, TALL);
  people.push(person);
  expect((await person.context.request.patch("/api/me", { data: { targetLanguage: "fr" } })).ok()).toBe(true);
  return person;
}

async function knowWords(person: Person, words: [string, string | null][]) {
  for (const [term, lemma] of words) {
    const res = await person.context.request.post("/api/vocabulary",
      { data: { language: "fr", term, status: "known", ...(lemma ? { lemma } : {}) } });
    expect(res.ok()).toBe(true);
  }
}

const SIX_FORMS_TWO_BASES: [string, string][] = [
  ["parle", "parler"], ["parlons", "parler"], ["parlé", "parler"], ["beau", "beau"], ["belle", "beau"], ["beaux", "beau"],
];

async function savedLemma(page: Page, term: string): Promise<string | null | undefined> {
  const found = await (await page.request.get(`/api/vocabulary?language=fr&q=${encodeURIComponent(term)}`)).json();
  const entry = (found.items as { term: string; lemma?: string }[]).find((e) => e.term === term);
  return entry ? entry.lemma ?? null : undefined;
}

function lookupsAnswer(page: Page, wordType: (term: string) => Record<string, unknown> | null) {
  return page.route("**/api/dictionary?*", (route) => {
    const term = new URL(route.request().url()).searchParams.get("term")!;
    return route.fulfill({ json: { term, language: "fr", meanings: ["meaning"], meaningLanguage: "en",
      source: "sentence", wordType: wordType(term) } });
  });
}

function frenchText(person: Person): Promise<Created> {
  return createTextWith(person.page, (w) => `${w(1)} ${w(2)} ${w(3)}.`);
}

test.describe("the honey jar setting", () => {
  test("shows all forms by default, base words once chosen, and the choice stays after reloading", async ({ browser }) => {
    const person = await learner(browser);
    await knowWords(person, SIX_FORMS_TWO_BASES);
    const { page } = person;
    await page.goto("/settings");

    await expect(known(page)).toHaveText("6 known");
    await expect(known(page)).toHaveAttribute("title", "6 known words (all forms)");
    await expect(known(page)).toHaveAccessibleName("6 known words (all forms)");
    await expect(honeyJar(page).getByRole("radio", { name: "All forms" })).toBeChecked();

    await honeyJar(page).getByRole("radio", { name: "Base words" }).check();
    await expect(known(page)).toHaveText("2 known");
    await expect(known(page)).toHaveAttribute("title", "2 known base words");

    await page.reload();
    await expect(honeyJar(page).getByRole("radio", { name: "Base words" })).toBeChecked();
    await expect(known(page)).toHaveText("2 known");

    await honeyJar(page).getByRole("radio", { name: "All forms" }).check();
    await expect(known(page)).toHaveText("6 known");
    await expect(known(page)).toHaveAttribute("title", "6 known words (all forms)");
  });

  test("when saving the choice fails, the error shows and nothing changes", async ({ browser }) => {
    const person = await learner(browser);
    await knowWords(person, SIX_FORMS_TWO_BASES);
    const { page } = person;
    await page.route("**/api/me", (route) =>
      route.request().method() === "PATCH"
        ? route.fulfill({ status: 500, json: { code: "server_error", message: "Could not save" } })
        : route.fallback());
    await page.goto("/settings");
    await expect(known(page)).toHaveText("6 known");

    await honeyJar(page).getByRole("radio", { name: "Base words" }).check();
    await expect(page.getByRole("region", { name: "Honey jar" }).getByRole("alert")).toBeVisible();
    await expect(honeyJar(page).getByRole("radio", { name: "All forms" })).toBeChecked();
    await expect(known(page)).toHaveText("6 known");
  });
});

test.describe("base words from the word popup", () => {
  test("clicking a form saves the base word its lookup gave", async ({ browser }) => {
    const person = await learner(browser);
    const created = await frenchText(person);
    await lookupsAnswer(person.page, () => ({ partOfSpeech: "verb", form: "present", lemma: "Parler" }));
    await openReader(person.page, `/read/${created.id}`);
    await article(person.page).getByText(created.word(1), { exact: true }).click();
    await expect.poll(() => savedLemma(person.page, created.word(1))).toBe("parler");
  });

  test("a form whose lookup gave a type and no base word is its own base word", async ({ browser }) => {
    const person = await learner(browser);
    const created = await frenchText(person);
    await lookupsAnswer(person.page, () => ({ partOfSpeech: "verb", form: "infinitive", lemma: null }));
    await openReader(person.page, `/read/${created.id}`);
    await article(person.page).getByText(created.word(1), { exact: true }).click();
    await expect.poll(() => savedLemma(person.page, created.word(1))).toBe(created.word(1));
  });

  test("a form whose lookup gave no word type is saved with no base word", async ({ browser }) => {
    const person = await learner(browser);
    const created = await frenchText(person);
    await lookupsAnswer(person.page, () => null);
    const sent: Record<string, unknown>[] = [];
    person.page.on("request", (r) => {
      if (r.url().includes("/api/vocabulary") && r.method() === "POST") sent.push(r.postDataJSON() ?? {});
    });
    await openReader(person.page, `/read/${created.id}`);
    await article(person.page).getByText(created.word(1), { exact: true }).click();
    await expect(person.page.getByTestId("meaning-headline")).toHaveText("meaning");
    await expect.poll(() => sent.some((b) => b.meaning === "meaning")).toBe(true);
    expect(sent.some((b) => "lemma" in b)).toBe(false);
    expect(await savedLemma(person.page, created.word(1))).toBeNull();
  });

  test("looking up a saved word that has no base word fills it in", async ({ browser }) => {
    const person = await learner(browser);
    const created = await frenchText(person);
    const res = await person.context.request.post("/api/vocabulary",
      { data: { language: "fr", term: created.word(1), status: "learning" } });
    expect(res.ok()).toBe(true);
    await lookupsAnswer(person.page, () => ({ partOfSpeech: "verb", form: "present", lemma: "siffloter" }));
    await openReader(person.page, `/read/${created.id}`);
    await article(person.page).getByText(created.word(1), { exact: true }).click();
    await expect.poll(() => savedLemma(person.page, created.word(1))).toBe("siffloter");
  });
});

test.describe("the honey jar in base-word mode", () => {
  test("a new form of a known base word leaves the jar, and a form of a new base word raises it", async ({ browser }) => {
    const person = await learner(browser);
    const { page } = person;
    const created = await frenchText(person);
    const family = `${created.prefix}famille`;
    await knowWords(person, [[created.word(2), family]]);
    expect((await person.context.request.patch("/api/me", { data: { honeyJar: "base_words" } })).ok()).toBe(true);
    await lookupsAnswer(page, (term) =>
      ({ partOfSpeech: "verb", form: "present", lemma: term === created.word(1) ? family : null }));
    await openReader(page, `/read/${created.id}`);
    await expect(known(page)).toHaveText("1 known");

    const marked = async (n: number) => {
      await article(page).getByText(created.word(n), { exact: true }).click();
      await expect(page.getByTestId("meaning-headline")).toHaveText("meaning");
      const refreshed = page.waitForResponse((r) => r.url().includes("/api/dashboard/header"));
      await page.getByRole("button", { name: "Known", exact: true }).click();
      await refreshed;
      await expect(page.getByTestId("polly-flight")).toHaveCount(0);
    };

    await marked(1);
    await page.waitForTimeout(500);
    await expect(known(page)).toHaveText("1 known");
    await expect(known(page)).toHaveAttribute("title", "1 known base word");

    await marked(3);
    await expect(known(page)).toHaveText("2 known");
  });
});

test.describe("both numbers elsewhere", () => {
  test("the dashboard shows base words beside all forms", async ({ browser }) => {
    const person = await learner(browser);
    await knowWords(person, SIX_FORMS_TWO_BASES);
    await person.page.goto("/dashboard");
    const card = person.page.getByRole("region", { name: "Known words" });
    await expect(card.getByTestId("known-words")).toHaveText("6");
    await expect(card.getByTestId("known-base-words")).toHaveText("2 base words");
    await expect(person.page.getByTestId("all-time")).toContainText("6 known words · 2 base words");
  });

  test("a teacher sees both numbers for each student and the class", async ({ browser }) => {
    const student = await learner(browser, "Bee student");
    const teacher = await learner(browser, "Bee teacher");
    expect((await teacher.context.request.post("/api/me/plan", { data: { tier: "CLASSROOM" } })).ok()).toBe(true);
    const cls = await (await teacher.context.request.post("/api/classes", { data: { name: "Abeilles", language: "fr" } })).json();
    expect((await student.context.request.post("/api/classes/join", { data: { code: cls.joinCode } })).ok()).toBe(true);
    await knowWords(student, SIX_FORMS_TWO_BASES);

    await teacher.page.goto(`/classes/${cls.id}`);
    const table = teacher.page.getByRole("table");
    await expect(table.getByRole("columnheader", { name: "Base words" })).toBeVisible();
    const row = table.getByRole("row").filter({ hasText: "Bee student" });
    await expect(row.getByRole("cell").nth(1)).toHaveText("6");
    await expect(row.getByRole("cell").nth(2)).toHaveText("2");
    await expect(teacher.page.getByTestId("average-known-words")).toHaveText("6");
    await expect(teacher.page.getByTestId("average-known-base-words")).toHaveText("2");
    await teacher.context.request.delete(`/api/classes/${cls.id}`);
  });
});
