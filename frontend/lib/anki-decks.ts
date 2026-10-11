import { fieldNames, type AnkiCardInfo } from "./anki-connect";
import type { AnkiCardPayload, AnkiDeckChoice } from "./anki-types";
import { LANGUAGES, languageName } from "./languages";
import type { LanguageCode } from "./types";

export interface DeckSetup {
  wordField: string;
  meaningField?: string;
  language: LanguageCode;
  fromExport: boolean;
}

export function languageFromField(value: string | undefined): LanguageCode | null {
  const text = (value ?? "").replace(/<[^>]*>/g, "").trim().toLowerCase();
  return LANGUAGES.find((l) => l.name.toLowerCase() === text || l.code === text)?.code ?? null;
}

export function suggestSetup(sample: AnkiCardInfo[], fallback: LanguageCode): DeckSetup | null {
  const first = sample[0];
  if (!first) return null;
  const fields = fieldNames(first);
  const fromExport = fields.includes("Word") && fields.includes("Language");
  if (fromExport) {
    return {
      wordField: "Word",
      meaningField: fields.includes("Definition") ? "Definition" : undefined,
      language: languageFromField(first.fields.Language?.value) ?? fallback,
      fromExport: true,
    };
  }
  return { wordField: fields[0], language: fallback, fromExport: false };
}

export function exampleWords(sample: AnkiCardInfo[], wordField: string): string[] {
  return sample
    .map((c) => (c.fields[wordField]?.value ?? "").replace(/\[sound:[^\]]*]/g, "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " "))
    .map((w) => w.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, 3);
}

export function toPayload(card: AnkiCardInfo, deck: Pick<AnkiDeckChoice, "wordField" | "meaningField">): AnkiCardPayload {
  const payload: AnkiCardPayload = { word: card.fields[deck.wordField]?.value ?? null, type: card.type, interval: card.interval };
  const meaning = deck.meaningField ? card.fields[deck.meaningField]?.value : undefined;
  if (meaning) payload.meaning = meaning;
  return payload;
}

export function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export function decksTitle(decks: AnkiDeckChoice[]): string {
  if (decks.length === 0) return "Your decks";
  const languages = [...new Set(decks.map((d) => d.language))].map(languageName);
  return `Your decks · ${decks.length} ${decks.length === 1 ? "deck" : "decks"} · ${languages.join(", ")}`;
}
