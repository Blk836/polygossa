import { expect, test, type Locator, type Page } from "@playwright/test";

// Shared helpers for the vocabulary map's browser tests (vocab-map.spec.ts, vocab-map-camera.spec.ts). The map on
// Progress (docs/acceptance/vocabulary-map.feature) is a hex continent with a country per region, a province per area
// and a tile per word. The shared test user has no target language, so each test picks French in the
// top bar with the switch answered in the browser (never saved), and saves the map words it needs through the API,
// deleting them afterwards. Tests run in parallel on that one user, so each test saves different words and deletes only
// its own.

/** The French words this test saved, from the map or the API: deleted after it. */
export const touched: string[] = [];

export async function clearWords(page: Page) {
  for (const term of touched.splice(0)) {
    await page.request.delete(`/api/vocabulary/by-term?language=fr&term=${encodeURIComponent(term)}`);
  }
}

/** Opens Progress with French picked in the top bar, answered in the browser so the test user keeps no language. */
export async function openInFrench(page: Page, path = "/dashboard") {
  await page.goto(path);
  const me = await (await page.request.get("/api/me")).json();
  await page.route("**/api/me", (route) => {
    if (route.request().method() !== "PATCH") return route.continue();
    const { targetLanguage } = route.request().postDataJSON();
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ...me, targetLanguage }) });
  });
  await pickLanguage(page, "Français");
  await expect(map(page).getByTestId("map-overall")).toBeVisible();
}

export async function pickLanguage(page: Page, native: string) {
  await page.getByRole("banner").getByRole("button", { name: /Change language/ }).click();
  await page.getByRole("menu", { name: "Language" }).getByRole("menuitemradio", { name: new RegExp(native) }).click();
}

export const map = (page: Page) => page.getByTestId("vocab-map");
export const world = (page: Page) => page.getByTestId("hex-map");
export const country = (page: Page, name: string) => map(page).getByTestId("map-region").and(page.getByRole("button", { name: new RegExp(`^${name}:`) }));
export const province = (page: Page, name: string) =>
  map(page).getByTestId("map-area").and(page.getByRole("button", { name: new RegExp(`^${name}:`) }));
export const label = (page: Page, kind: "region-label" | "area-label", id: string) => map(page).locator(`[data-testid="${kind}"][data-id="${id}"]`);
export const wordTile = (page: Page, term: string) => map(page).locator(`[data-testid="map-word"][data-term="${term}"]`);
export const wordText = (page: Page, term: string) => map(page).locator("text.map-word-label").getByText(term, { exact: true });
export const zoom = async (page: Page) => Number(await world(page).getAttribute("data-zoom"));
export const bandButton = (page: Page, band: string) => map(page).getByRole("group", { name: "Bands counted" }).getByRole("button", { name: `Up to ${band}` });

/** How many tiles of a kind (known, learning, new, ignored, next, later) the map draws: one shape each in that kind's path. */
export async function tileCount(page: Page, kind?: string): Promise<number> {
  const selector = kind ? `[data-testid="map-tiles"] path[data-kind="${kind}"]` : '[data-testid="map-tiles"] path';
  return map(page).locator(selector).evaluateAll((paths) => paths.reduce((n, p) => n + (p.getAttribute("d")!.match(/M/g) ?? []).length, 0));
}

export async function save(page: Page, term: string, status: string) {
  touched.push(term);
  const res = await page.request.post("/api/vocabulary", { data: { language: "fr", term, status } });
  expect(res.ok(), await res.text()).toBe(true);
}

/** Waits until the camera has come to rest (it reports its zoom when it stops) and returns that zoom. */
export async function restingZoom(page: Page): Promise<number> {
  let last = -1;
  await expect.poll(async () => {
    const now = await zoom(page);
    const still = now === last;
    last = now;
    return still;
  }, { intervals: [150, 150, 150, 300] }).toBe(true);
  return last;
}

/** How many times the world's transform changes while {@code action} runs: one for a jump, many for a glide. */
export async function transformChanges(page: Page, action: () => Promise<void>, settle: Locator): Promise<number> {
  await page.evaluate(() => {
    const g = document.querySelector('[data-testid="hex-map"] > g')!;
    const w = window as unknown as { __changes: number; __observer?: MutationObserver };
    w.__observer?.disconnect();
    w.__changes = 0;
    w.__observer = new MutationObserver((list) => (w.__changes += list.length));
    w.__observer.observe(g, { attributes: true, attributeFilter: ["transform"] });
  });
  await action();
  await expect(settle).toBeVisible();
  await page.waitForTimeout(700);
  return page.evaluate(() => (window as unknown as { __changes: number }).__changes);
}

/** Signs in before each test, and deletes the words it saved and the band it picked after it. */
export function cleanUpAfterEach() {
  test.beforeEach(async ({ page }) => {
    await page.goto("/library"); // signs in (auto-login) for page.request
  });

  test.afterEach(async ({ page }) => {
    await clearWords(page);
    try {
      await page.evaluate(() => window.localStorage.removeItem("lector_map_band"));
    } catch {
      // The page may already be gone.
    }
  });
}
