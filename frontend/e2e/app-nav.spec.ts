import { expect, test, type Page } from "@playwright/test";

// The header: four top-level tabs (Library, Practice, Progress, Forum) with sub-tabs, the account menu (Settings, Classes,
// plan, sign out) and the Practice due-cards badge. Known words and the streak flame are in app-nav-header.spec.ts.

const topNav = (page: Page) => page.getByRole("banner").getByRole("navigation", { name: "Main" });
const sections = (page: Page) => page.getByRole("navigation", { name: "Section" });

async function stubDue(page: Page, dueWords: number, dueSentences = 0) {
  await page.route("**/api/review/stats*", (route) =>
    route.fulfill({ json: { dueWords, dueSentences, reviewedToday: 0, dailyGoal: 20, goalMet: false, streak: 0, history: [] } }),
  );
}

test.describe("top-level tabs", () => {
  test("the header has just Library, Practice, Progress and Forum", async ({ page }) => {
    await page.goto("/library");
    await expect(topNav(page).getByRole("link")).toHaveText(["Library", /^Practice/, "Progress", "Forum"]);
    for (const old of ["Explore", "Playlists", "Words", "Review", "Write", "Classes", "Settings"]) {
      await expect(topNav(page).getByRole("link", { name: old, exact: true })).toHaveCount(0);
    }
  });

  for (const [path, tab, current, all] of [
    ["/library", "Library", "Mine", ["Mine", "Saved", "Explore", "Playlists"]],
    ["/library/saved", "Library", "Saved", ["Mine", "Saved", "Explore", "Playlists"]],
    ["/community", "Library", "Explore", ["Mine", "Saved", "Explore", "Playlists"]],
    ["/playlists", "Library", "Playlists", ["Mine", "Saved", "Explore", "Playlists"]],
    ["/review", "Practice", "Review", ["Review", "Words", "Write"]],
    ["/vocabulary", "Practice", "Words", ["Review", "Words", "Write"]],
    ["/writing", "Practice", "Write", ["Review", "Words", "Write"]],
  ] as const) {
    test(`${path} marks ${tab} and its ${current} sub-tab`, async ({ page }) => {
      await page.goto(path);
      await expect(topNav(page).locator("[aria-current=page]")).toHaveText(new RegExp(`^${tab}`));
      await expect(sections(page).getByRole("link")).toHaveText([...all]);
      await expect(sections(page).locator("[aria-current=page]")).toHaveText(current);
    });
  }

  test("Progress has no sub-tabs", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(topNav(page).locator("[aria-current=page]")).toHaveText("Progress");
    await expect(sections(page)).toHaveCount(0);
  });

  for (const path of ["/forum", "/forum/new", "/forum/999999"]) {
    test(`${path} marks the Forum tab and shows no sub-tabs`, async ({ page }) => {
      await page.goto(path);
      await expect(topNav(page).locator("[aria-current=page]")).toHaveText("Forum");
      await expect(sections(page)).toHaveCount(0);
    });
  }

  test("importing a text keeps Library marked but shows no sub-tabs", async ({ page }) => {
    await page.goto("/import");
    await expect(topNav(page).locator("[aria-current=page]")).toHaveText("Library");
    await expect(sections(page)).toHaveCount(0);
  });

  test("Settings marks no tab", async ({ page }) => {
    await page.goto("/settings");
    await expect(topNav(page).locator("[aria-current=page]")).toHaveCount(0);
    await expect(sections(page)).toHaveCount(0);
  });

  test("tabs and sub-tabs navigate", async ({ page }) => {
    await page.goto("/library");
    await topNav(page).getByRole("link", { name: /^Practice/ }).click();
    await page.waitForURL("**/review");
    await sections(page).getByRole("link", { name: "Words" }).click();
    await page.waitForURL("**/vocabulary");
    await topNav(page).getByRole("link", { name: "Library" }).click();
    await page.waitForURL("**/library");
    await sections(page).getByRole("link", { name: "Explore" }).click();
    await page.waitForURL("**/community");
  });
});

test.describe("account menu", () => {
  const menuButton = (page: Page) => page.getByRole("button", { name: "Account" });
  const menu = (page: Page) => page.getByRole("menu", { name: "Account" });

  test("holds Settings, Classes and the plan; the plan and the forum are no longer in it", async ({ page }) => {
    await page.goto("/library");
    await expect(page.getByRole("banner").getByText("Classroom", { exact: true })).toHaveCount(0);
    await expect(menu(page)).toHaveCount(0);
    await menuButton(page).click();
    await expect(menuButton(page)).toHaveAttribute("aria-expanded", "true");
    // The test account is one of the team (FORUM_ADMINS), so it also has the admin panel.
    await expect(menu(page).getByRole("menuitem")).toHaveText(["Settings", "Classes", "Admin"]);
    await expect(menu(page).getByTestId("account-plan")).toHaveText("Classroom plan");
    await expect(menu(page)).toContainText("test@lector.local");
    // The auto-login test account would just be signed straight back in.
    await expect(menu(page).getByRole("menuitem", { name: "Sign out" })).toHaveCount(0);
  });

  test("choosing an item goes there and closes the menu", async ({ page }) => {
    await page.goto("/library");
    await menuButton(page).click();
    await menu(page).getByRole("menuitem", { name: "Classes" }).click();
    await page.waitForURL("**/classes");
    await expect(menu(page)).toHaveCount(0);
    await expect(menuButton(page)).toHaveAttribute("aria-current", "page");
  });

  test("Escape and clicking elsewhere close it", async ({ page }) => {
    await page.goto("/library");
    await menuButton(page).click();
    await page.keyboard.press("Escape");
    await expect(menu(page)).toHaveCount(0);
    await expect(menuButton(page)).toBeFocused();
    await menuButton(page).click();
    await page.locator("main").click({ position: { x: 5, y: 5 } });
    await expect(menu(page)).toHaveCount(0);
  });
});

test.describe("due-cards badge", () => {
  const practice = (page: Page) => topNav(page).getByRole("link", { name: /^Practice/ });

  test("shows how many cards are due, words and sentences together", async ({ page }) => {
    await stubDue(page, 3, 2);
    await page.goto("/library");
    await expect(practice(page).getByTestId("due-badge")).toHaveText("5");
    await expect(practice(page)).toHaveAccessibleName("Practice, 5 cards due");
  });

  test("is hidden with nothing due", async ({ page }) => {
    await stubDue(page, 0);
    await page.goto("/library");
    await expect(practice(page)).toHaveAccessibleName("Practice");
    await expect(practice(page).getByTestId("due-badge")).toHaveCount(0);
  });

  test("caps at 99+", async ({ page }) => {
    await stubDue(page, 150, 3);
    await page.goto("/library");
    await expect(practice(page).getByTestId("due-badge")).toHaveText("99+");
    await expect(practice(page)).toHaveAccessibleName("Practice, 153 cards due");
  });

  test("a failing stats request just hides the badge", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("**/api/review/stats*", (route) => route.fulfill({ status: 402, json: { code: "upgrade_required", message: "Pro" } }));
    await page.goto("/library");
    await expect(practice(page)).toHaveAccessibleName("Practice");
    expect(errors).toEqual([]);
  });

  test("updates after moving to another page", async ({ page }) => {
    let due = 4;
    await page.route("**/api/review/stats*", (route) =>
      route.fulfill({ json: { dueWords: due, dueSentences: 0, reviewedToday: 0, dailyGoal: 20, goalMet: false, streak: 0, history: [] } }),
    );
    await page.goto("/library");
    await expect(practice(page).getByTestId("due-badge")).toHaveText("4");
    due = 1;
    await sections(page).getByRole("link", { name: "Explore" }).click();
    await expect(practice(page).getByTestId("due-badge")).toHaveText("1");
  });
});

test.describe("phones", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("the bottom bar has the four tabs, and sub-tabs and the account menu still work", async ({ page }) => {
    await page.goto("/vocabulary");
    const bottom = page.getByRole("navigation", { name: "Main" }).last();
    await expect(bottom.getByRole("link")).toHaveText(["Library", /^Practice/, "Progress", "Forum"]);
    await expect(bottom.getByRole("link").locator("svg")).toHaveCount(4);
    await expect(bottom.locator("[aria-current=page]")).toHaveText(/^Practice/);
    await expect(sections(page).getByRole("link", { name: "Words" })).toBeVisible();
    await page.getByRole("button", { name: "Account" }).click();
    await expect(page.getByRole("menu", { name: "Account" }).getByRole("menuitem", { name: "Settings" })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
