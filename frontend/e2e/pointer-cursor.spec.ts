import { expect, test, type Locator, type Page } from "@playwright/test";

const cursor = (el: Locator) => el.evaluate((e) => getComputedStyle(e).cursor);

test("the top bar's language picker and profile menu show the hand, like the counters beside them", async ({ page }) => {
  await page.goto("/library");
  const banner = page.getByRole("banner");
  await expect.poll(() => cursor(banner.getByTestId("streak-flame"))).toBe("pointer");
  expect(await cursor(banner.getByRole("button", { name: /Change language/ }))).toBe("pointer");
  expect(await cursor(banner.getByRole("button", { name: "Account" }))).toBe("pointer");
});

test("buttons inside the open menus show the hand", async ({ page }) => {
  await page.goto("/library");
  await page.getByRole("banner").getByRole("button", { name: /Change language/ }).click();
  const option = page.getByRole("menu", { name: "Language" }).getByRole("menuitemradio").first();
  expect(await cursor(option)).toBe("pointer");
});

async function addControls(page: Page) {
  await page.goto("/library");
  await page.getByRole("banner").waitFor();
  await page.evaluate(() => {
    const box = document.createElement("div");
    box.innerHTML = `
      <div role="button" tabindex="0" data-testid="role-button">Custom</div>
      <details><summary data-testid="summary">More</summary>Hidden</details>
      <button type="button" disabled data-testid="disabled">Not yet</button>
      <input type="text" data-testid="text-input" />
      <textarea data-testid="text-area"></textarea>`;
    document.body.append(box);
  });
}

test("clickable controls that are not buttons show the hand", async ({ page }) => {
  await addControls(page);
  expect(await cursor(page.getByTestId("role-button"))).toBe("pointer");
  expect(await cursor(page.getByTestId("summary"))).toBe("pointer");
});

test("a disabled button keeps the plain arrow and text boxes keep the I-beam", async ({ page }) => {
  await addControls(page);
  expect(await cursor(page.getByTestId("disabled"))).toBe("default");
  expect(await cursor(page.getByTestId("text-input"))).toBe("text");
  expect(await cursor(page.getByTestId("text-area"))).toBe("text");
});
