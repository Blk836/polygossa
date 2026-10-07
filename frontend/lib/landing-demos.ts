// Sample sentences for the landing page's try-it-now reader, one per language. Words carry a short gloss; `k` marks
// words a beginner would already know (shown without a highlight), the rest start as new (blue).
import { demoSentence as sentence, type DemoToken } from "./landing";
import type { LanguageCode } from "./types";

const K = { k: true };

export const DEMOS: Record<LanguageCode, DemoToken[]> = {
  en: sentence([
    ["Every", "each one, all", "determiner", K], ["evening", "the end of the day", "noun"], ",", ["my", "belonging to me", "possessive", K],
    ["neighbour", "a person who lives next door", "noun"], ["walks", "goes on foot — from walk", "verb"], ["her", "belonging to her", "possessive", K],
    ["old", "not young", "adjective", K], ["dog", "an animal kept as a pet", "noun", K], ["along", "following the length of", "preposition"],
    ["the", "the", "article", K], ["river", "a large natural stream of water", "noun"], ".",
  ]),
  es: sentence([
    ["Cada", "each, every", "determiner", K], ["mañana", "morning", "noun"], ",", ["Lucía", "Lucía (a name)", "name", K],
    ["camina", "walks — from caminar", "verb"], ["hasta", "as far as, until", "preposition"], ["un", "a, an", "article", K],
    ["pequeño", "small, little", "adjective"], ["café", "café; coffee", "noun", K], ["cerca", "near, close", "adverb"],
    ["del", "of the (de + el)", "contraction", K], ["mar", "sea", "noun"], ".",
  ]),
  fr: sentence([
    ["Le", "the; on (with days)", "article", K], ["dimanche", "Sunday", "noun"], ",", ["nous", "we", "pronoun", K],
    ["allons", "go — from aller", "verb"], ["au", "to the (à + le)", "contraction", K], ["marché", "market", "noun"],
    ["pour", "to, in order to", "preposition", K], ["acheter", "to buy", "verb"], ["du", "some (de + le)", "article", K],
    ["pain", "bread", "noun"], ["frais", "fresh", "adjective"], ".",
  ]),
  de: sentence([
    ["Am", "on the (an + dem)", "contraction", K], ["Wochenende", "weekend", "noun"], ["fahren", "travel, go — from fahren", "verb"],
    ["wir", "we", "pronoun", K], ["mit", "with, by", "preposition", K], ["dem", "the", "article", K], ["Zug", "train", "noun"],
    ["in", "in, into", "preposition", K], ["die", "the", "article", K], ["Berge", "mountains — plural of Berg", "noun"], ".",
  ]),
  it: sentence([
    ["La", "the", "article", K], ["sera", "evening", "noun"], ",", ["mia", "my", "possessive", K], ["nonna", "grandmother", "noun"],
    ["prepara", "makes, prepares — from preparare", "verb"], ["sempre", "always", "adverb"], ["una", "a, an", "article", K],
    ["zuppa", "soup", "noun"], ["calda", "hot, warm", "adjective"], ".",
  ]),
  pt: sentence([
    ["Todos", "all, every", "determiner", K], ["os", "the", "article", K], ["dias", "days", "noun", K], ",", ["o", "the", "article", K],
    ["meu", "my", "possessive", K], ["avô", "grandfather", "noun"], ["lê", "reads — from ler", "verb"], ["o", "the", "article", K],
    ["jornal", "newspaper", "noun"], ["na", "on the, in the (em + a)", "contraction", K], ["varanda", "balcony", "noun"], ".",
  ]),
  ja: sentence([
    ["毎朝", "every morning", "noun", { r: "まいあさ" }], "、", ["私", "I, me", "pronoun", { k: true, r: "わたし" }],
    ["は", "topic marker", "particle", { k: true, r: "wa" }], ["駅", "station", "noun", { r: "えき" }],
    ["の", "possessive / linking particle", "particle", { k: true, r: "no" }], ["近く", "nearby, near", "noun", { r: "ちかく" }],
    ["で", "at (place of action)", "particle", { k: true, r: "de" }], ["コーヒー", "coffee", "noun", { k: true, r: "kōhī" }],
    ["を", "object marker", "particle", { k: true, r: "o" }], ["飲みます", "drink — polite form of 飲む", "verb", { r: "のみます" }], "。",
  ], ""),
  zh: sentence([
    ["我", "I, me", "pronoun", { k: true, r: "wǒ" }], ["每天", "every day", "adverb", { r: "měitiān" }],
    ["早上", "morning", "noun", { r: "zǎoshang" }], ["在", "at, in", "preposition", { k: true, r: "zài" }],
    ["公园", "park", "noun", { r: "gōngyuán" }], ["里", "inside", "locative", { k: true, r: "lǐ" }],
    ["跑步", "to run, jog", "verb", { r: "pǎobù" }], "。",
  ], ""),
  ko: sentence([
    ["주말에", "at the weekend (주말 + 에)", "noun + particle", { r: "jumal-e" }],
    ["친구와", "with a friend (친구 + 와)", "noun + particle", { r: "chingu-wa" }], ["함께", "together", "adverb", { k: true, r: "hamkke" }],
    ["영화를", "a movie (영화 + object marker)", "noun + particle", { r: "yeonghwa-reul" }],
    ["봤어요", "watched — past polite of 보다", "verb", { r: "bwasseoyo" }], ".",
  ]),
};
