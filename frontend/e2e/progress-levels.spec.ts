import { expect, test, type Page, type Route } from "@playwright/test";

// The Skill levels card on Progress (docs/acceptance/skill-levels.feature). One test checks the card against the real
// API for test@lector.local; the rest serve fixed levels so every state (no data, estimates, overall) is shown.
// Nothing here changes the shared test user: switching language is answered in the browser, never saved.

type Fixture = Record<string, unknown>;

const FULL: Fixture = {
  knownWords: 1300,
  listeningSeconds: 5700,
  reading: { level: "B1", confidence: "medium", evidence: 3 },
  listening: { level: "A2", confidence: "low", evidence: 2 },
  writing: { level: "A2", confidence: "low", evidence: 2 },
  overall: { level: "A2", basedOn: ["reading", "listening", "writing"] },
};

const PARTIAL: Fixture = {
  knownWords: 1300,
  listeningSeconds: 0,
  reading: { level: "B1", confidence: "high", evidence: 12 },
  listening: { evidence: 0 },
  writing: { level: "A2", confidence: "medium", evidence: 3 },
  overall: { level: "A2", basedOn: ["reading", "writing"] },
};

const EMPTY: Fixture = {
  knownWords: 0,
  listeningSeconds: 0,
  reading: { evidence: 0 },
  listening: { evidence: 0 },
  writing: { evidence: 0 },
};

/** The language Progress shows levels for: the top-bar language, else the first with progress (as the page does). */
async function shownLanguage(page: Page): Promise<{ me: Record<string, unknown>; language: string }> {
  await page.goto("/library"); // signs in (auto-login) for page.request
  const me = await (await page.request.get("/api/me")).json();
  const dashboard = await (await page.request.get("/api/dashboard")).json();
  const language = me.targetLanguage ?? dashboard.languages[0]?.language;
  expect(language, "the test user needs a target language or some progress").toBeTruthy();
  return { me, language };
}

/** Serves {@code byLanguage[language]} (else {@code fallback}) for every levels request; records the languages asked. */
async function serveLevels(page: Page, fallback: Fixture, byLanguage: Record<string, Fixture> = {}) {
  const asked: string[] = [];
  await page.route("**/api/levels?**", (route: Route) => {
    const language = new URL(route.request().url()).searchParams.get("language") ?? "";
    asked.push(language);
    const body = { ...(byLanguage[language] ?? fallback), language };
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
  return asked;
}

const card = (page: Page) => page.getByRole("region", { name: "Skill levels" });
const skill = (page: Page, name: string) => card(page).getByRole("group", { name });

test("the card shows the levels the API computes for my language", async ({ page }) => {
  const { language } = await shownLanguage(page);
  const expected = await (await page.request.get(`/api/levels?language=${language}`)).json();
  await page.goto("/dashboard");
  for (const [key, name] of [["reading", "Reading"], ["listening", "Listening"], ["writing", "Writing"]] as const) {
    await expect(skill(page, name).getByTestId("skill-level")).toHaveText(expected[key].level ?? "Not enough data");
  }
});

test("each skill shows its level, confidence and evidence", async ({ page }) => {
  await shownLanguage(page);
  await serveLevels(page, FULL);
  await page.goto("/dashboard");

  const reading = skill(page, "Reading");
  await expect(reading.getByTestId("skill-level")).toHaveText("B1");
  await expect(reading).toContainText("Medium confidence");
  await expect(reading).toContainText("1,300 known words · 3 finished texts");

  const listening = skill(page, "Listening");
  await expect(listening.getByTestId("skill-level")).toHaveText("A2");
  await expect(listening).toContainText("Estimate · low confidence");
  await expect(listening).toContainText("1h 35m listened");

  const writing = skill(page, "Writing");
  await expect(writing.getByTestId("skill-level")).toHaveText("A2");
  await expect(writing).toContainText("Based on 2 graded tests");

  await expect(card(page).getByTestId("overall-level")).toHaveText("Overall A2");
});

test("a skill without data says so and what to do next", async ({ page }) => {
  await shownLanguage(page);
  await serveLevels(page, PARTIAL);
  await page.goto("/dashboard");

  const listening = skill(page, "Listening");
  await expect(listening.getByTestId("skill-level")).toHaveText("Not enough data");
  await expect(listening.getByRole("link", { name: "Watch a video" })).toHaveAttribute("href", "/community");
  await expect(skill(page, "Reading")).not.toContainText("Estimate");
  await expect(card(page).getByTestId("overall-level")).toHaveText("Overall A2 · based on Reading and Writing only");
});

test("a new learner sees no levels and no overall", async ({ page }) => {
  await shownLanguage(page);
  await serveLevels(page, EMPTY);
  await page.goto("/dashboard");

  await expect(card(page).getByTestId("skill-level")).toHaveText(["Not enough data", "Not enough data", "Not enough data"]);
  await expect(skill(page, "Writing").getByRole("link", { name: "Take a writing test" })).toHaveAttribute("href", "/writing");
  await expect(skill(page, "Reading").getByRole("link", { name: "Start reading" })).toHaveAttribute("href", "/library");
  await expect(card(page).getByTestId("overall-level")).toHaveCount(0);
});

test("levels follow the language picked in the top bar", async ({ page }) => {
  const { me, language } = await shownLanguage(page);
  const other = language === "fr" ? { code: "de", native: "Deutsch" } : { code: "fr", native: "Français" };
  const asked = await serveLevels(page, FULL, { [other.code]: { ...PARTIAL, reading: { level: "C1", confidence: "high", evidence: 10 } } });
  // Answer the switch in the browser so the shared test user's language is never changed.
  await page.route("**/api/me", (route) =>
    route.request().method() === "PATCH"
      ? route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ...me, targetLanguage: other.code }) })
      : route.continue());
  await page.goto("/dashboard");
  await expect(skill(page, "Reading").getByTestId("skill-level")).toHaveText("B1");

  await page.getByRole("button", { name: /Change language/ }).click();
  await page.getByRole("menuitemradio", { name: new RegExp(other.native) }).click();
  await expect(skill(page, "Reading").getByTestId("skill-level")).toHaveText("C1");
  expect(asked[0]).toBe(language);
  expect(asked.at(-1)).toBe(other.code);
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("a failure to load levels is shown in the card", async ({ page }) => {
  await shownLanguage(page);
  await page.route("**/api/levels?**", (route) =>
    route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ code: "error", message: "Levels are unavailable" }) }));
  await page.goto("/dashboard");
  await expect(card(page)).toContainText("Levels are unavailable");
  await expect(page.getByRole("region", { name: "Daily streak" })).toBeVisible();
});
