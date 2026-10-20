import { expect, test, type Page } from "@playwright/test";
import { epub } from "./epub";

let cleanup: (() => Promise<void>) | null = null;

test.afterEach(async () => {
  await cleanup?.();
  cleanup = null;
});

async function importBook(page: Page) {
  await page.goto("/library");
  const me = await (await page.request.get("/api/me")).json();
  const language = (me.targetLanguage ?? "es") as string;
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1e4)}`;
  const book = await page.request.post("/api/texts/import-book", {
    multipart: {
      language,
      file: { name: "libro.epub", mimeType: "application/epub+zip",
        buffer: epub(`Libro ${stamp}`, [[`Uno ${stamp}`, "Había una vez un gato."], [`Dos ${stamp}`, "El gato se fue."]]) },
    },
  });
  expect(book.ok(), await book.text()).toBe(true);
  const { playlistId, textIds } = (await book.json()) as { playlistId: number; textIds: number[] };
  const pasted = await page.request.post("/api/texts", {
    data: { title: `Pegado ${stamp}`, language, content: "Un texto pegado.", isPublic: false, category: "other" },
  });
  expect(pasted.ok()).toBe(true);
  const pastedId = (await pasted.json()).id as number;
  cleanup = async () => {
    for (const id of [...textIds, pastedId]) await page.request.delete(`/api/texts/${id}`);
    await page.request.delete(`/api/playlists/${playlistId}`);
  };
  return { stamp, playlistId, pastedId };
}

const card = (page: Page, title: string) => page.locator("main article").filter({ hasText: title });

test("a chapter imported from a book has no Share button, and a pasted text still has one", async ({ page }) => {
  const { stamp } = await importBook(page);
  await page.goto("/library");
  await expect(card(page, `Uno ${stamp}`)).toBeVisible();
  await expect(card(page, `Uno ${stamp}`).getByRole("button", { name: "Share" })).toHaveCount(0);
  await expect(card(page, `Pegado ${stamp}`).getByRole("button", { name: "Share" })).toBeVisible();
});

test("a shared book playlist says its chapters stay private, without asking to share them", async ({ page }) => {
  const { playlistId } = await importBook(page);
  expect((await page.request.patch(`/api/playlists/${playlistId}`, { data: { isPublic: true } })).ok()).toBe(true);
  await page.goto(`/playlists/${playlistId}`);
  await expect(page.getByTestId("book-items-note")).toHaveText("2 chapters come from a book you imported and stay private, so only you can see them.");
  await expect(page.getByText("share them from your library")).toHaveCount(0);
});

test("other private items in a shared playlist are still pointed out", async ({ page }) => {
  const { playlistId, pastedId } = await importBook(page);
  expect((await page.request.put(`/api/playlists/${playlistId}/items/${pastedId}`)).ok()).toBe(true);
  expect((await page.request.patch(`/api/playlists/${playlistId}`, { data: { isPublic: true } })).ok()).toBe(true);
  await page.goto(`/playlists/${playlistId}`);
  await expect(page.getByText("1 item is private, so only you can see it — share them from your library to include them.")).toBeVisible();
  await expect(page.getByTestId("book-items-note")).toBeVisible();
});
