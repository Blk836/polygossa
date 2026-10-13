import { expect, test, type Page } from "@playwright/test";
import { article, cleanUp, createTextWith, openReader, type Created } from "./reader-helpers";

let created: Created | null = null;

test.afterEach(async ({ page }) => {
  await cleanUp(page, created);
  created = null;
});

const word = (page: Page, text: string, nth = 0) => article(page).locator("span.w").filter({ hasText: new RegExp(`^${text}$`) }).nth(nth);

async function mark(page: Page, from: string, to: string, status: "Learning" | "Known", nth = 0) {
  await word(page, from, nth).scrollIntoViewIfNeeded();
  const a = (await word(page, from, nth).boundingBox())!;
  const b = (await word(page, to, nth).boundingBox())!;
  await page.mouse.move(a.x + 3, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 });
  await page.mouse.up();
  const saved = page.waitForResponse((r) => r.url().endsWith("/api/vocabulary") && r.request().method() === "POST");
  await page.getByRole("button", { name: status, exact: true }).click();
  expect((await saved).ok()).toBe(true);
  await page.keyboard.press("Escape");
}

async function expectYellow(page: Page, words: string[], nth = 0) {
  for (const w of words) await expect(word(page, w, nth)).toHaveClass(/\bp-learning\b/);
}

async function expectNotYellow(page: Page, words: string[], nth = 0) {
  for (const w of words) await expect(word(page, w, nth)).not.toHaveClass(/\bp-learning\b/);
}

async function reload(page: Page, c: Created) {
  await openReader(page, `/read/${c.id}`);
}

test.describe("a learning phrase is yellow whatever separates its words", () => {
  test("a non-breaking space: yellow at once and after reloading", async ({ page }) => {
    const c = (created = await createTextWith(page, (w) => `${w(1)} ${w(2)} ${w(3)} ${w(4)}.`));
    await openReader(page, `/read/${c.id}`);
    await mark(page, c.word(2), c.word(3), "Learning");
    await expectYellow(page, [c.word(2), c.word(3)]);
    await reload(page, c);
    await expectYellow(page, [c.word(2), c.word(3)]);
    await expectNotYellow(page, [c.word(1), c.word(4)]);
  });

  test("a narrow non-breaking space, a line break and two spaces: yellow in each place, before and after reloading", async ({ page }) => {
    const c = (created = await createTextWith(page, (w) =>
      `${w(1)} ${w(2)} ${w(3)}. ${w(4)} ${w(2)}\n${w(3)}. ${w(5)} ${w(2)}  ${w(3)}.`));
    await openReader(page, `/read/${c.id}`);
    await mark(page, c.word(2), c.word(3), "Learning");
    for (const nth of [0, 1, 2]) await expectYellow(page, [c.word(2), c.word(3)], nth);
    await reload(page, c);
    for (const nth of [0, 1, 2]) await expectYellow(page, [c.word(2), c.word(3)], nth);
  });

  test("a curly apostrophe in the text: yellow, before and after reloading", async ({ page }) => {
    const c = (created = await createTextWith(page, (w) => `${w(1)} ${w(2)}’${w(3)} ${w(4)} ${w(5)}.`));
    await openReader(page, `/read/${c.id}`);
    const last = c.word(4);
    const first = await article(page).locator("span.w").filter({ hasText: c.word(2) }).first().textContent();
    await mark(page, first!, last, "Learning");
    await expectYellow(page, [first!, last]);
    await reload(page, c);
    await expectYellow(page, [first!, last]);
  });
});

test.describe("a learning phrase stays yellow beside a known phrase", () => {
  test("marking a learning phrase inside a known one", async ({ page }) => {
    const c = (created = await createTextWith(page, (w) => `${w(1)} ${w(2)} ${w(3)} ${w(4)}.`));
    await openReader(page, `/read/${c.id}`);
    await mark(page, c.word(1), c.word(3), "Known");
    await mark(page, c.word(2), c.word(3), "Learning");
    await expectYellow(page, [c.word(2), c.word(3)]);
    await expectNotYellow(page, [c.word(1)]);
    await reload(page, c);
    await expectYellow(page, [c.word(2), c.word(3)]);
    await expectNotYellow(page, [c.word(1)]);
  });

  test("marking a known phrase around a learning one", async ({ page }) => {
    const c = (created = await createTextWith(page, (w) => `${w(1)} ${w(2)} ${w(3)} ${w(4)}.`));
    await openReader(page, `/read/${c.id}`);
    await mark(page, c.word(2), c.word(3), "Learning");
    await mark(page, c.word(1), c.word(3), "Known");
    await expectYellow(page, [c.word(2), c.word(3)]);
    await expectNotYellow(page, [c.word(1)]);
    await reload(page, c);
    await expectYellow(page, [c.word(2), c.word(3)]);
    await expectNotYellow(page, [c.word(1)]);
  });

  test("a known phrase inside a learning one", async ({ page }) => {
    const c = (created = await createTextWith(page, (w) => `${w(1)} ${w(2)} ${w(3)} ${w(4)}.`));
    await openReader(page, `/read/${c.id}`);
    await mark(page, c.word(2), c.word(3), "Known");
    await mark(page, c.word(1), c.word(3), "Learning");
    await expectYellow(page, [c.word(1), c.word(2), c.word(3)]);
    await reload(page, c);
    await expectYellow(page, [c.word(1), c.word(2), c.word(3)]);
  });
});
