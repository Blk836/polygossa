import { expect, test, type Browser, type BrowserContext, type Locator, type Page } from "@playwright/test";
import type { WritingTest } from "../lib/types";

export async function proLearner(browser: Browser): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({ baseURL: test.info().project.use.baseURL, viewport: { width: 1280, height: 900 } });
  const email = `writing-${Date.now()}-${Math.random().toString(36).slice(2)}@test.co`;
  const signup = await context.request.post("/api/auth/signup", { data: { email, password: "password123", displayName: "Writer" } });
  expect(signup.ok(), await signup.text()).toBe(true);
  expect((await context.request.post("/api/me/plan", { data: { tier: "PRO" } })).ok()).toBe(true);
  expect((await context.request.patch("/api/me", { data: { targetLanguage: "es", tours: false } })).ok()).toBe(true);
  return { context, page: await context.newPage() };
}

export async function startTest(page: Page): Promise<WritingTest> {
  const res = await page.request.post("/api/writing/tests", { data: { language: "es", level: "A1" } });
  expect(res.ok(), await res.text()).toBe(true);
  return (await res.json()) as WritingTest;
}

export const answerFor = (t: WritingTest) => Array.from({ length: t.minWords + 5 }, (_, i) => (i % 2 ? "gato" : "perro")).join(" ");

export function graded(t: WritingTest, content: string): WritingTest {
  return {
    ...t,
    status: "graded",
    content,
    wordCount: content.split(" ").length,
    submittedAt: new Date().toISOString(),
    grade: {
      score: 72,
      level: "A1",
      summary: "A clear answer.",
      rubric: (["task", "grammar", "vocabulary", "coherence"] as const).map((criterion) => ({ criterion, score: 4, comment: "Good." })),
      corrections: [],
      correctedText: content,
    },
  };
}

export function holdSubmit(page: Page, answers: ((t: WritingTest) => { status: number; json: unknown } | null)[], t: WritingTest) {
  const state = { calls: 0, release: () => {} };
  const released = new Promise<void>((resolve) => (state.release = resolve));
  void page.route("**/api/writing/tests/*/submit", async (route) => {
    const answer = answers[Math.min(state.calls, answers.length - 1)];
    state.calls += 1;
    await released;
    const reply = answer(t);
    if (reply) await route.fulfill({ status: reply.status, json: reply.json });
    else await route.fallback();
  });
  return state;
}

export const ok = (content: string) => (t: WritingTest) => ({ status: 200, json: graded(t, content) });
export const failure = () => ({ status: 503, json: { code: "unavailable", message: "The server is busy, try again." } });

export const answerBox = (page: Page) => page.getByRole("textbox", { name: "Your answer" });
export const handIn = (page: Page) => page.getByRole("button", { name: "Hand in" });
export const resultsOutline = (page: Page) => page.getByRole("status", { name: "Loading results" });
export const results = (page: Page) => page.getByRole("button", { name: "Take another test" });
export const subTab = (page: Page, name: string) => page.getByRole("navigation", { name: "Section" }).getByRole("link", { name, exact: true });

export async function top(locator: Locator) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  expect(box, "element has a box").not.toBeNull();
  return Math.round(box!.y);
}
