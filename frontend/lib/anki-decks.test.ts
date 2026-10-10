import { describe, expect, it } from "vitest";
import type { AnkiCardInfo } from "./anki-connect";
import { chunks, exampleWords, languageFromField, suggestSetup, toPayload } from "./anki-decks";

function card(fields: Record<string, string>, type = 2, interval = 30): AnkiCardInfo {
  const entries = Object.entries(fields).map(([name, value], order) => [name, { value, order }]);
  return { cardId: 1, deckName: "D", modelName: "M", fields: Object.fromEntries(entries), type, interval };
}

describe("a deck exported from this app", () => {
  it("is recognised by its Word and Language fields, with its language and meaning field", () => {
    const sample = [card({ Word: "perro", Definition: "dog", Pronunciation: "", Language: "Spanish" })];
    expect(suggestSetup(sample, "fr")).toEqual({ wordField: "Word", meaningField: "Definition", language: "es", fromExport: true });
  });

  it("falls back to the study language when the Language field isn't one we know", () => {
    expect(suggestSetup([card({ Word: "x", Language: "Klingon" })], "fr")?.language).toBe("fr");
  });
});

describe("one of my own decks", () => {
  it("defaults to its first field and my study language, with no meaning field", () => {
    expect(suggestSetup([card({ Front: "perro", Back: "dog" })], "es")).toEqual({ wordField: "Front", language: "es", fromExport: false });
  });

  it("has no setup when it holds no cards", () => {
    expect(suggestSetup([], "es")).toBeNull();
  });
});

describe("reading cards", () => {
  it.each([["Spanish", "es"], ["<b>French</b>", "fr"], ["de", "de"], ["", null]])("%s is the language %s", (value, code) => {
    expect(languageFromField(value)).toBe(code);
  });

  it("shows up to three example words as plain text", () => {
    const sample = [card({ Front: "<b>perro</b>&nbsp;" }), card({ Front: "[sound:a.mp3]gato" }), card({ Front: "" }), card({ Front: "casa" }), card({ Front: "mesa" })];
    expect(exampleWords(sample, "Front")).toEqual(["perro", "gato", "casa"]);
  });

  it("sends only the word, the card's state and the chosen meaning", () => {
    const c = card({ Front: "perro", Back: "dog", Notes: "private" }, 2, 40);
    expect(toPayload(c, { wordField: "Front", meaningField: "Back" })).toEqual({ word: "perro", type: 2, interval: 40, meaning: "dog" });
    expect(toPayload(c, { wordField: "Front" })).toEqual({ word: "perro", type: 2, interval: 40 });
    expect(toPayload(c, { wordField: "Missing" }).word).toBeNull();
  });

  it("splits cards into batches", () => {
    expect(chunks([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunks([], 2)).toEqual([]);
  });
});
