import { expect, test, type Locator, type Page, type Route } from "@playwright/test";
import { article, cleanUp, createText, createTextWith, openReader, setReaderCookie, type Created } from "./reader-helpers";

let created: Created | null = null;

test.use({ viewport: { width: 1280, height: 900 } });
test.beforeEach(async ({ page }) => setReaderCookie(page, "known%3D0"));
test.afterEach(async ({ page }) => {
  await cleanUp(page, created);
  created = null;
});

const popup = (page: Page) => page.locator("[data-word-popup]");

interface Lookups {
  terms: string[];
  hold: boolean;
  held: Route[];
  failFirst: Set<string>;
  release: () => Promise<void>;
}

async function watchLookups(page: Page): Promise<Lookups> {
  const lookups: Lookups = {
    terms: [], hold: false, held: [], failFirst: new Set(),
    release: async () => {
      lookups.hold = false;
      for (const r of lookups.held.splice(0)) await answer(r).catch(() => undefined);
    },
  };
  const answer = (route: Route) => {
    const term = new URL(route.request().url()).searchParams.get("term")!;
    return route.fulfill({ json: { term, language: "es", meanings: [`meaning of ${term}`], meaningLanguage: "en", source: "sentence", wordType: null } });
  };
  await page.route("**/api/dictionary?*", (route) => {
    const term = new URL(route.request().url()).searchParams.get("term")!;
    lookups.terms.push(term);
    if (lookups.failFirst.delete(term)) return route.fulfill({ status: 500, json: { code: "ai", message: "down" } });
    if (lookups.hold) return void lookups.held.push(route);
    return answer(route);
  });
  return lookups;
}

async function box(locator: Locator) {
  await locator.scrollIntoViewIfNeeded();
  const b = await locator.boundingBox();
  if (!b) throw new Error("not visible");
  return b;
}

async function threeWords(page: Page) {
  created = await createTextWith(page, (w) => `${w(1)} ${w(2)} ${w(3)}.`);
  return [1, 2, 3].map((n) => created!.word(n));
}

const word = (page: Page, text: string) => article(page).locator("[data-i]", { hasText: new RegExp(`^${text}$`) });

async function below(page: Page, text: string, gap: number) {
  const b = await box(word(page, text));
  return { x: b.x + b.width / 2, y: b.y + b.height + gap };
}

test("a blue word near the mouse is asked for before it is clicked, and the click reuses the answer", async ({ page }) => {
  const lookups = await watchLookups(page);
  const [, middle] = await threeWords(page);
  await openReader(page, `/read/${created!.id}`);
  const near = await below(page, middle, 30);
  await page.mouse.move(near.x, near.y);
  await expect.poll(() => lookups.terms).toContain(middle);
  await word(page, middle).click();
  await expect(popup(page)).toContainText(`meaning of ${middle}`);
  expect(lookups.terms.filter((t) => t === middle)).toHaveLength(1);
});

test("every blue word within reach is asked for, the nearest first", async ({ page }) => {
  const lookups = await watchLookups(page);
  const [first, middle, last] = await threeWords(page);
  await openReader(page, `/read/${created!.id}`);
  const near = await below(page, middle, 10);
  await page.mouse.move(near.x, near.y);
  await expect.poll(() => [...lookups.terms].sort()).toEqual([first, middle, last].sort());
  expect(lookups.terms[0]).toBe(middle);
});

test("a blue word further than 60 px away is not asked for", async ({ page }) => {
  const lookups = await watchLookups(page);
  const [, middle] = await threeWords(page);
  await openReader(page, `/read/${created!.id}`);
  const far = await below(page, middle, 90);
  await page.mouse.move(far.x, far.y);
  await page.mouse.move(far.x + 5, far.y + 5);
  await page.waitForTimeout(500);
  expect(lookups.terms).toEqual([]);
});

test("only blue words are asked for, not learning or known ones", async ({ page }) => {
  const lookups = await watchLookups(page);
  const [first, middle, last] = await threeWords(page);
  for (const [term, status] of [[first, "known"], [last, "learning"]]) {
    const res = await page.request.post("/api/vocabulary", { data: { language: created!.language, term, status } });
    expect(res.ok(), await res.text()).toBe(true);
  }
  await openReader(page, `/read/${created!.id}`);
  await expect(word(page, first)).toHaveClass(/w-known/);
  const near = await below(page, middle, 10);
  await page.mouse.move(near.x, near.y);
  await expect.poll(() => lookups.terms).toContain(middle);
  await page.waitForTimeout(300);
  expect(lookups.terms).toEqual([middle]);
});

test("moving back and forth asks once, and a click while the answer is on its way waits for it", async ({ page }) => {
  const lookups = await watchLookups(page);
  const [, middle] = await threeWords(page);
  await openReader(page, `/read/${created!.id}`);
  lookups.hold = true;
  const near = await below(page, middle, 20);
  for (let k = 0; k < 4; k++) {
    await page.mouse.move(near.x, near.y);
    await page.mouse.move(near.x, near.y + 200);
  }
  await expect.poll(() => lookups.terms).toContain(middle);
  await word(page, middle).click();
  await expect(popup(page).getByRole("status", { name: "Loading" })).toBeVisible();
  await lookups.release();
  await expect(popup(page)).toContainText(`meaning of ${middle}`);
  expect(lookups.terms.filter((t) => t === middle)).toHaveLength(1);
});

test("asking ahead doesn't mark the word looked up: it stays blue until clicked", async ({ page }) => {
  const lookups = await watchLookups(page);
  const saved: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/api/vocabulary") && r.method() !== "GET") saved.push(r.url());
  });
  const [, middle] = await threeWords(page);
  await openReader(page, `/read/${created!.id}`);
  const near = await below(page, middle, 30);
  await page.mouse.move(near.x, near.y);
  await expect.poll(() => lookups.terms).toContain(middle);
  await page.waitForTimeout(300);
  expect(saved).toEqual([]);
  await expect(word(page, middle)).toHaveClass(/w-new/);
});

test("a failed early request shows nothing, and clicking asks again", async ({ page }) => {
  const lookups = await watchLookups(page);
  const [, middle] = await threeWords(page);
  lookups.failFirst.add(middle);
  await openReader(page, `/read/${created!.id}`);
  const near = await below(page, middle, 30);
  await page.mouse.move(near.x, near.y);
  await expect.poll(() => lookups.terms).toContain(middle);
  await page.waitForTimeout(300);
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByText("down")).toHaveCount(0);
  await word(page, middle).click();
  await expect(popup(page)).toContainText(`meaning of ${middle}`);
  expect(lookups.terms.filter((t) => t === middle)).toHaveLength(2);
});

test("turning the page drops the old page's waiting words", async ({ page }) => {
  const lookups = await watchLookups(page);
  created = await createText(page);
  await openReader(page, `/read/${created.id}`);
  lookups.hold = true;
  const middle = article(page).locator("[data-i]").nth(40);
  const b = await box(middle);
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await expect.poll(() => lookups.terms.length).toBe(4);
  const before = lookups.terms.length;
  await page.keyboard.press("ArrowRight");
  await expect(word(page, created.word(1))).toHaveCount(0);
  const shown = new Set(await article(page).locator("[data-i]").allTextContents());
  await lookups.release();
  await page.waitForTimeout(500);
  await lookups.release();
  for (const term of lookups.terms.slice(before)) expect(shown, `${term} is on the old page`).toContain(term);
});

test.describe("on a touch screen", () => {
  test.use({ hasTouch: true });

  test("touching the page asks for nothing until a word is tapped", async ({ page }) => {
    const lookups = await watchLookups(page);
    const [, middle] = await threeWords(page);
    await openReader(page, `/read/${created!.id}`);
    const near = await below(page, middle, 30);
    await page.touchscreen.tap(near.x, near.y);
    await page.waitForTimeout(500);
    expect(lookups.terms).toEqual([]);
  });
});
