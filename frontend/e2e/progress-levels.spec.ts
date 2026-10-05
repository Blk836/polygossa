import { expect, test, type Page, type Route } from "@playwright/test";

// The Skill levels card on Progress (docs/acceptance/skill-levels.feature). One test checks the card against the real
// API for test@lector.local; the rest serve fixed levels so every state (no data, estimates, overall) is shown.

// Each test sets the shared test user's language, so they run one at a time.
test.describe.configure({ mode: "serial" });

type Fixture = Record<string, unknown>;

const FULL: Fixture = {
  language: "es",
  knownWords: 1300,
  listeningSeconds: 5700,
  reading: { level: "B1", confidence: "medium", evidence: 3 },
  listening: { level: "A2", confidence: "low", evidence: 2 },
  writing: { level: "A2", confidence: "low", evidence: 2 },
  overall: { level: "A2", basedOn: ["reading", "listening", "writing"] },
};

const PARTIAL: Fixture = {
  language: "es",
  knownWords: 1300,
  listeningSeconds: 0,
  reading: { level: "B1", confidence: "high", evidence: 12 },
  listening: { evidence: 0 },
  writing: { level: "A2", confidence: "medium", evidence: 3 },
  overall: { level: "A2", basedOn: ["reading", "writing"] },
};

const EMPTY: Fixture = {
  language: "es",
  knownWords: 0,
  listeningSeconds: 0,
  reading: { evidence: 0 },
  listening: { evidence: 0 },
  writing: { evidence: 0 },
};

/** Serves the levels for each requested language from {@code byLanguage}; records the languages asked for. */
async function serveLevels(page: Page, byLanguage: Record<string, Fixture>) {
  const asked: string[] = [];
  await page.route("**/api/levels?**", (route: Route) => {
    const language = new URL(route.request().url()).searchParams.get("language") ?? "";
    asked.push(language);
    const body = byLanguage[language] ?? { ...EMPTY, language };
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
  return asked;
}

let originalLanguage: string | null = null;

async function setLanguage(page: Page, code: string) {
  await page.goto("/library"); // signs in (auto-login) for page.request
  const me = await (await page.request.get("/api/me")).json();
  originalLanguage ??= me.targetLanguage;
  const res = await page.request.patch("/api/me", { data: { targetLanguage: code } });
  expect(res.ok(), await res.text()).toBe(true);
}

test.afterEach(async ({ page }) => {
  if (originalLanguage) await page.request.patch("/api/me", { data: { targetLanguage: originalLanguage } });
  originalLanguage = null;
});

const card = (page: Page) => page.getByRole("region", { name: "Skill levels" });
const skill = (page: Page, name: string) => card(page).getByRole("group", { name });

test("the card shows the levels the API computes for my language", async ({ page }) => {
  await setLanguage(page, "es");
  const expected = await (await page.request.get("/api/levels?language=es")).json();
  await page.goto("/dashboard");
  for (const [key, name] of [["reading", "Reading"], ["listening", "Listening"], ["writing", "Writing"]] as const) {
    await expect(skill(page, name).getByTestId("skill-level")).toHaveText(expected[key].level ?? "Not enough data");
  }
});

test("each skill shows its level, confidence and evidence", async ({ page }) => {
  await setLanguage(page, "es");
  await serveLevels(page, { es: FULL });
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
  await setLanguage(page, "es");
  await serveLevels(page, { es: PARTIAL });
  await page.goto("/dashboard");

  const listening = skill(page, "Listening");
  await expect(listening.getByTestId("skill-level")).toHaveText("Not enough data");
  await expect(listening.getByRole("link", { name: "Watch a video" })).toHaveAttribute("href", "/community");
  await expect(skill(page, "Reading")).not.toContainText("Estimate");
  await expect(card(page).getByTestId("overall-level")).toHaveText("Overall A2 · based on Reading and Writing only");
});

test("a new learner sees no levels and no overall", async ({ page }) => {
  await setLanguage(page, "es");
  await serveLevels(page, { es: EMPTY });
  await page.goto("/dashboard");

  await expect(card(page).getByTestId("skill-level")).toHaveText(["Not enough data", "Not enough data", "Not enough data"]);
  await expect(skill(page, "Writing").getByRole("link", { name: "Take a writing test" })).toHaveAttribute("href", "/writing");
  await expect(skill(page, "Reading").getByRole("link", { name: "Start reading" })).toHaveAttribute("href", "/library");
  await expect(card(page).getByTestId("overall-level")).toHaveCount(0);
});

test("levels follow the language picked in the top bar", async ({ page }) => {
  await setLanguage(page, "es");
  const asked = await serveLevels(page, { es: FULL, fr: { ...PARTIAL, language: "fr", reading: { level: "C1", confidence: "high", evidence: 10 } } });
  await page.goto("/dashboard");
  await expect(skill(page, "Reading").getByTestId("skill-level")).toHaveText("B1");

  await page.getByRole("button", { name: /Change language/ }).click();
  await page.getByRole("menuitemradio", { name: /Français/ }).click();
  await expect(skill(page, "Reading").getByTestId("skill-level")).toHaveText("C1");
  expect(asked).toContain("fr");
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("a failure to load levels is shown in the card", async ({ page }) => {
  await setLanguage(page, "es");
  await page.route("**/api/levels?**", (route) =>
    route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ code: "error", message: "Levels are unavailable" }) }));
  await page.goto("/dashboard");
  await expect(card(page)).toContainText("Levels are unavailable");
  await expect(page.getByRole("region", { name: "Daily streak" })).toBeVisible();
});
