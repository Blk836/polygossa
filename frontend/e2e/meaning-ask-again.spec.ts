import { expect, test } from "@playwright/test";
import { article, cleanUp, createTextWith, openReader, popupClose, type Created } from "./reader-helpers";

let created: Created | null = null;
test.afterEach(async ({ page }) => {
  await cleanUp(page, created);
  created = null;
});

test("after the AI gave nothing, clicking the word again asks again, and an AI answer is kept", async ({ page }) => {
  created = await createTextWith(page, (w) => `${w(1)} ${w(2)} ${w(3)}.`);
  const word = created.word(2);
  const asked: URL[] = [];
  await page.route("**/api/dictionary?*", (route) => {
    asked.push(new URL(route.request().url()));
    const answered = asked.length > 1;
    return route.fulfill({ json: { term: word, language: created!.language, meaningLanguage: "en",
      meanings: answered ? ["unequal"] : [], source: answered ? "sentence" : null } });
  });
  await openReader(page, `/read/${created.id}`);
  const clickWord = () => article(page).getByText(word, { exact: true }).click();

  await clickWord();
  await expect(page.getByTestId("meanings")).toHaveText("No English meaning yet");
  expect(asked).toHaveLength(1);
  expect(asked[0].searchParams.get("bare")).toBeNull();
  expect(asked[0].searchParams.get("before")).toContain(created.word(1));

  await popupClose(page).click();
  await clickWord();
  await expect(page.getByTestId("meaning-headline")).toHaveText("unequal");
  expect(asked).toHaveLength(2);

  await popupClose(page).click();
  await clickWord();
  await expect(page.getByTestId("meaning-headline")).toHaveText("unequal");
  expect(asked).toHaveLength(2);
});
