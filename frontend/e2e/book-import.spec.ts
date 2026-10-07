import { expect, test } from "@playwright/test";
import { epub } from "./epub";

// docs/acceptance/book-import.feature: Import › Book turns an EPUB into a private playlist of chapters.

test("importing an EPUB opens its first chapter, inside a playlist of the book", async ({ page }) => {
  const title = `Libro ${Date.now()}`;
  await page.goto("/library"); // signs in first, like the other specs
  await page.goto("/import");
  await page.getByRole("button", { name: "Book (EPUB, PDF)" }).click();
  await expect(page.getByText("Share in the community library")).toHaveCount(0);
  await page.getByRole("combobox", { name: "Language" }).selectOption("es");
  await page.getByLabel("Book file").setInputFiles({
    name: "libro.epub",
    mimeType: "application/epub+zip",
    buffer: epub(title, [["Capítulo uno", "Había una vez un gato."], ["Capítulo dos", "El gato se fue."]]),
  });
  await page.getByRole("button", { name: "Import and start reading" }).click();
  await page.waitForURL(/\/read\/\d+/);
  await expect(page.locator("article")).toContainText("Había una vez un gato.");
  await expect(page.getByRole("link", { name: title })).toBeVisible();

  const playlists = (await (await page.request.get("/api/playlists")).json()) as { id: number; title: string; isPublic: boolean }[];
  const book = playlists.find((p) => p.title === title)!;
  expect(book.isPublic).toBe(false);
  const detail = await (await page.request.get(`/api/playlists/${book.id}`)).json();
  expect(detail.items.map((i: { title: string }) => i.title)).toEqual(["Capítulo uno", "Capítulo dos"]);
  for (const item of detail.items) await page.request.delete(`/api/texts/${item.id}`);
  await page.request.delete(`/api/playlists/${book.id}`);
});

test("a file that isn't a book says so", async ({ page }) => {
  await page.goto("/library"); // signs in first, like the other specs
  await page.goto("/import");
  await page.getByRole("button", { name: "Book (EPUB, PDF)" }).click();
  await page.getByLabel("Book file").setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hola") });
  await page.getByRole("button", { name: "Import and start reading" }).click();
  await expect(page.getByText("Upload an EPUB or a PDF")).toBeVisible();
});
