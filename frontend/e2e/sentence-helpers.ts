import { expect, type Page } from "@playwright/test";
import { article, PER_SENTENCE, setReaderCookie, wordAt } from "./reader-helpers";

export const SENTENCE_VIEW = "view%3Dsentences";

export const setSentenceView = (page: Page, more = "") => setReaderCookie(page, more ? `${SENTENCE_VIEW}%26${more}` : SENTENCE_VIEW);

export const sentenceNav = (page: Page) => page.getByRole("navigation", { name: "Sentences" });
export const nextSentence = (page: Page) => sentenceNav(page).getByRole("button", { name: "Next sentence" });
export const previousSentence = (page: Page) => sentenceNav(page).getByRole("button", { name: "Previous sentence" });
export const current = (page: Page) => article(page).locator('[data-sentence="current"]');
export const before = (page: Page) => article(page).locator('[data-sentence="previous"]');
export const after = (page: Page) => article(page).locator('[data-sentence="next"]');

export const firstWordOf = (n: number) => (n - 1) * PER_SENTENCE;

export async function onSentence(page: Page, n: number, count: number) {
  await expect(sentenceNav(page)).toContainText(`${n} / ${count}`);
  await expect(current(page).locator(`[data-i="${2 * firstWordOf(n)}"]`)).toBeVisible();
}

export const sentenceWord = (page: Page, n: number, k = 0) => wordAt(page, firstWordOf(n) + k);

export function markKnownCalls(page: Page) {
  const calls: { fromToken: number; toToken: number }[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/mark-known") && r.method() === "POST") calls.push(r.postDataJSON());
  });
  return calls;
}
