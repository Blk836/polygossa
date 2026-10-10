import { describe, expect, it } from "vitest";
import type { AnkiCardInfo } from "./anki-connect";
import { guessMeaningField, guessWordField, isCloze, noWrittenWord, planDeck, setupFor, type ModelInDeck } from "./anki-note-types";
import type { AnkiDeckChoice } from "./anki-types";

function card(fields: Record<string, string>): AnkiCardInfo {
  const entries = Object.entries(fields).map(([name, value], order) => [name, { value, order }]);
  return { cardId: 1, deckName: "D", modelName: "M", fields: Object.fromEntries(entries), type: 2, interval: 30 };
}

function model(name: string, fields: Record<string, string>, cards = 3, modelId = 1): ModelInDeck {
  return { modelId, name, ids: Array.from({ length: cards }, (_, i) => i + 1), fields: Object.keys(fields), sample: [card(fields)] };
}

const deck = (over: Partial<AnkiDeckChoice> = {}): AnkiDeckChoice => ({ ankiDeckId: 9, name: "D", language: "es", wordField: "Front", ...over });

describe("the guessed word field", () => {
  it.each([
    [["Front", "Back"], "Front"],
    [["Sentence", "Word", "Translation"], "Word"],
    [["Expression", "Meaning", "Reading"], "Expression"],
    [["Sentence", "Target Word", "Audio"], "Target Word"],
    [["Picture", "Vocab", "Notes"], "Vocab"],
    [["English", "Spanish"], "English"],
    [["front", "WORD"], "WORD"],
    [[], ""],
  ])("of %j is %s", (fields, guess) => {
    expect(guessWordField(fields)).toBe(guess);
  });

  it("pairs a meaning field that isn't the word field", () => {
    expect(guessMeaningField(["Front", "Back"], "Front")).toBe("Back");
    expect(guessMeaningField(["Word", "Meaning", "Back"], "Word")).toBe("Meaning");
    expect(guessMeaningField(["Back", "Front"], "Back")).toBeUndefined();
  });
});

describe("note types that start skipped", () => {
  it("cloze, by name or by its text", () => {
    expect(isCloze("Cloze", [])).toBe(true);
    expect(isCloze("My sentences", [card({ Text: "El {{c1::perro}} ladra" })])).toBe(true);
    expect(isCloze("Basic", [card({ Front: "perro" })])).toBe(false);
  });

  it("a field with only pictures or sounds has no written word", () => {
    expect(noWrittenWord([card({ Image: "<img src=a.jpg>" })], "Image")).toBe(true);
    expect(noWrittenWord([card({ Sound: "[sound:a.mp3]" })], "Sound")).toBe(true);
    expect(noWrittenWord([card({ Front: "<img src=a.jpg> perro" })], "Front")).toBe(false);
  });

  it("are set to skip with their reason", () => {
    const cloze = setupFor(model("Cloze", { Text: "{{c1::x}}", Extra: "" }), undefined);
    expect([cloze.wordField, cloze.skipReason]).toEqual([undefined, "cloze"]);
    const pictures = setupFor(model("Pictures", { Picture: "<img src=a.jpg>", Back: "perro" }), undefined);
    expect([pictures.wordField, pictures.skipReason]).toEqual([undefined, "no-word"]);
  });
});

describe("a note type's setup", () => {
  it("in a deck not saved yet is a guess, not marked new", () => {
    expect(setupFor(model("Basic", { Front: "dog", Back: "perro" }, 5), undefined)).toMatchObject({
      wordField: "Front", meaningField: "Back", cards: 5, isNew: false, skipReason: null,
    });
  });

  it("uses the choice saved for it", () => {
    const saved = deck({ noteTypes: [{ modelId: 1, name: "Basic", wordField: "Back", meaningField: "Front" }] });
    expect(setupFor(model("Basic", { Front: "dog", Back: "perro" }), saved)).toMatchObject({ wordField: "Back", meaningField: "Front", isNew: false });
  });

  it("keeps a skip that was saved", () => {
    const saved = deck({ noteTypes: [{ modelId: 1, name: "Basic" }] });
    expect(setupFor(model("Basic", { Front: "dog" }), saved).wordField).toBeUndefined();
  });

  it("added to a saved deck later is a guess marked new", () => {
    const saved = deck({ noteTypes: [{ modelId: 1, name: "Basic", wordField: "Front" }] });
    expect(setupFor(model("Vocab", { Word: "perro" }, 3, 2), saved)).toMatchObject({ wordField: "Word", isNew: true });
  });

  it("in a deck saved before note types uses the deck's field where it exists, and is new elsewhere", () => {
    const old = deck({ wordField: "Front", meaningField: "Back" });
    expect(setupFor(model("Basic", { Front: "perro", Back: "dog" }), old)).toMatchObject({ wordField: "Front", meaningField: "Back", isNew: false });
    expect(setupFor(model("Vocab", { Word: "perro" }, 3, 2), old)).toMatchObject({ wordField: "Word", isNew: true });
  });
});

describe("what a sync reads", () => {
  const models = [
    { modelId: 1, fields: ["Front", "Back"], ids: [1, 2] },
    { modelId: 2, fields: ["Text"], ids: [3, 4, 5] },
    { modelId: 3, fields: ["Word"], ids: [6] },
  ];

  it("reads confirmed note types, leaves out skipped ones, and waits for new ones", () => {
    const saved = deck({ noteTypes: [{ modelId: 1, name: "Basic", wordField: "Back", meaningField: "Front" }, { modelId: 2, name: "Cloze" }] });
    expect(planDeck(saved, models)).toEqual({ reads: [{ ids: [1, 2], wordField: "Back", meaningField: "Front" }], skipped: 3, waiting: 1 });
  });

  it("in a deck saved before note types, reads those with the deck's field and waits for the rest", () => {
    expect(planDeck(deck({ wordField: "Word" }), models)).toEqual({ reads: [{ ids: [6], wordField: "Word", meaningField: undefined }], skipped: 0, waiting: 5 });
  });
});
