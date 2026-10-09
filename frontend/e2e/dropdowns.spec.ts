import { expect, test, type Locator, type Page } from "@playwright/test";
import { cleanUp, createText, type Created } from "./reader-helpers";

let created: Created | null = null;

test.afterEach(async ({ page }) => {
  await cleanUp(page, created);
  created = null;
});

interface SelectLook {
  radius: number;
  height: number;
  appearance: string;
  cursor: string;
  label: string;
}

async function looks(page: Page): Promise<SelectLook[]> {
  return page.locator("main select, header select").evaluateAll((els) =>
    els.map((el) => {
      const s = getComputedStyle(el);
      return {
        radius: parseFloat(s.borderTopLeftRadius),
        height: el.getBoundingClientRect().height,
        appearance: s.appearance,
        cursor: s.cursor,
        label: el.getAttribute("aria-label") ?? el.closest("label")?.textContent ?? el.outerHTML.slice(0, 60),
      };
    }),
  );
}

function expectStyled(all: SelectLook[]) {
  expect(all.length).toBeGreaterThan(0);
  for (const s of all) {
    expect(s.appearance, s.label).toBe("base-select");
    expect(s.cursor, s.label).toBe("pointer");
    expect(s.radius, s.label).toBeGreaterThanOrEqual(Math.min(8, s.height / 2));
  }
}

async function libraryCard(page: Page): Promise<Locator> {
  created = await createText(page, 30);
  await page.goto("/library");
  const card = page.getByRole("article").filter({ hasText: `Reader check ${created.prefix}` });
  await expect(card.getByRole("combobox", { name: "Category" })).toBeVisible();
  return card;
}

for (const path of ["/vocabulary", "/community", "/playlists", "/import", "/settings"]) {
  test(`dropdowns on ${path} are rounded with the app's chevron`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator("main select").first()).toBeVisible();
    expectStyled(await looks(page));
  });
}

test("the category dropdown on a library card is a rounded pill", async ({ page }) => {
  const card = await libraryCard(page);
  const select = card.getByRole("combobox", { name: "Category" });
  const box = (await select.boundingBox())!;
  const radius = await select.evaluate((el) => parseFloat(getComputedStyle(el).borderTopLeftRadius));
  expect(radius).toBeGreaterThanOrEqual(box.height / 2 - 0.5);
  expectStyled(await looks(page));
});

test("its option list opens as a rounded card and choosing with the mouse saves", async ({ page }) => {
  const card = await libraryCard(page);
  const select = card.getByRole("combobox", { name: "Category" });
  await select.click();
  const news = select.getByRole("option", { name: "News" });
  await expect(news).toBeVisible();
  const list = await select.evaluate((el) => {
    const s = getComputedStyle(el, "::picker(select)");
    return { radius: parseFloat(s.borderTopLeftRadius), background: s.backgroundColor, shadow: s.boxShadow };
  });
  const cardBackground = await page.evaluate(() => {
    const probe = document.createElement("div");
    probe.className = "bg-card";
    document.body.append(probe);
    const colour = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return colour;
  });
  expect(list.radius).toBeGreaterThanOrEqual(12);
  expect(list.background).toBe(cardBackground);
  expect(list.shadow).not.toBe("none");
  await news.click();
  await expect(select).toHaveValue("news");
  await expect.poll(async () => (await (await page.request.get(`/api/texts/${created!.id}`)).json()).text.category).toBe("news");
});

test("the keyboard opens the list and picks an option", async ({ page }) => {
  const card = await libraryCard(page);
  const select = card.getByRole("combobox", { name: "Category" });
  await select.focus();
  await page.keyboard.press("Enter");
  await expect(select.getByRole("option", { name: "News" })).toBeVisible();
  await select.getByRole("option", { name: "News" }).focus();
  await page.keyboard.press("Enter");
  await expect(select).toHaveValue("news");
  await expect(select.getByRole("option", { name: "News" })).toBeHidden();
});

test.describe("in dark mode", () => {
  test.use({ colorScheme: "dark" });

  test("the open list stays dark, with readable options", async ({ page }) => {
    await page.goto("/vocabulary");
    const select = page.getByRole("combobox", { name: "Sort" });
    await select.click();
    const option = select.getByRole("option").first();
    await expect(option).toBeVisible();
    const [bg, fg] = await select.evaluate((el) => {
      const s = getComputedStyle(el, "::picker(select)");
      const o = getComputedStyle(el.querySelector("option")!);
      return [s.backgroundColor, o.color];
    });
    const lum = (c: string) => {
      const [r, g, b] = c.match(/[\d.]+/g)!.map(Number);
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    expect(lum(bg)).toBeLessThan(80);
    expect(lum(fg)).toBeGreaterThan(160);
  });
});
