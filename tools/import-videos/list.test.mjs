import { test } from "node:test";
import assert from "node:assert/strict";
import { parseList, videoId } from "./list.mjs";

const options = { languages: ["fr", "es", "de"], categories: ["daily-life", "news", "other"] };
const parse = (text, defaultLanguage) => parseList(text, { ...options, defaultLanguage });

test("each line gives a URL, a language and an optional category", () => {
  const entries = parse("https://www.youtube.com/watch?v=AAAAAAAAAAA fr\nhttps://youtu.be/BBBBBBBBBBB es daily-life\n");
  assert.deepEqual(entries, [
    { line: 1, url: "https://www.youtube.com/watch?v=AAAAAAAAAAA", language: "fr", category: null },
    { line: 2, url: "https://youtu.be/BBBBBBBBBBB", language: "es", category: "daily-life" },
  ]);
});

test("a default language applies to lines that don't give one; a line's own language wins", () => {
  const entries = parse("https://youtu.be/AAAAAAAAAAA\nhttps://youtu.be/BBBBBBBBBBB es\nhttps://youtu.be/CCCCCCCCCCC news", "de");
  assert.deepEqual(entries.map((e) => [e.language, e.category]), [["de", null], ["es", null], ["de", "news"]]);
});

test("comments, blank lines and trailing comments are ignored; line numbers are kept", () => {
  const entries = parse("# French news\n\n   \nhttps://youtu.be/AAAAAAAAAAA fr  # imported: Le marché\r\n");
  assert.deepEqual(entries, [{ line: 4, url: "https://youtu.be/AAAAAAAAAAA", language: "fr", category: null }]);
});

test("languages and categories are matched case-insensitively", () => {
  assert.deepEqual(parse("https://youtu.be/AAAAAAAAAAA FR Daily-Life")[0],
    { line: 1, url: "https://youtu.be/AAAAAAAAAAA", language: "fr", category: "daily-life" });
});

test("an unknown language or category makes the line invalid, with the reason", () => {
  const [lang, cat] = parse("https://youtu.be/AAAAAAAAAAA xx\nhttps://youtu.be/BBBBBBBBBBB fr cooking");
  assert.deepEqual(lang, { line: 1, url: "https://youtu.be/AAAAAAAAAAA", error: 'unknown language or category "xx"' });
  assert.deepEqual(cat, { line: 2, url: "https://youtu.be/BBBBBBBBBBB", error: 'unknown language or category "cooking"' });
});

test("a line that isn't a YouTube video is invalid", () => {
  assert.deepEqual(parse("https://example.com/watch?v=AAAAAAAAAAA fr")[0],
    { line: 1, url: "https://example.com/watch?v=AAAAAAAAAAA", error: "not a YouTube video link" });
  assert.equal(parse("hello fr")[0].error, "not a YouTube video link");
});

test("a line with no language and no default is invalid", () => {
  assert.equal(parse("https://youtu.be/AAAAAAAAAAA news")[0].error, "no language: add one to the line or pass --language");
});

test("two languages, two categories or extra words make the line invalid", () => {
  assert.equal(parse("https://youtu.be/AAAAAAAAAAA fr es")[0].error, 'more than one language ("fr", "es")');
  assert.equal(parse("https://youtu.be/AAAAAAAAAAA fr news other")[0].error, 'more than one category ("news", "other")');
});

test("every YouTube URL form gives the video id", () => {
  const id = "AAAAAAAAAA_";
  for (const url of [
    `https://www.youtube.com/watch?v=${id}`,
    `https://youtube.com/watch?feature=share&v=${id}&t=30s`,
    `https://m.youtube.com/watch?v=${id}`,
    `https://youtu.be/${id}?si=xyz`,
    `https://www.youtube.com/shorts/${id}`,
    `https://www.youtube.com/embed/${id}`,
    `https://www.youtube.com/live/${id}`,
    `http://youtube.com/watch?v=${id}`,
    `www.youtube.com/watch?v=${id}`,
  ]) {
    assert.equal(videoId(url), id, url);
  }
});

test("anything else has no video id", () => {
  for (const url of [
    "https://www.youtube.com/watch?v=short",
    "https://www.youtube.com/@channel",
    "https://www.youtube.com/playlist?list=PL123",
    "https://notyoutube.com/watch?v=AAAAAAAAAAA",
    "https://youtu.be/AAAAAAAAAAAA",
    "",
  ]) {
    assert.equal(videoId(url), null, url);
  }
});
