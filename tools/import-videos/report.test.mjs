import { test } from "node:test";
import assert from "node:assert/strict";
import { resultsFile, retryFile, summary } from "./report.mjs";

const entry = (line, url, language, category = null) => ({ line, url, language, category });
const results = [
  { entry: entry(1, "https://youtu.be/AAAAAAAAAAA", "fr"), outcome: "imported", reason: "food", title: "Le marché" },
  { entry: entry(2, "https://youtu.be/BBBBBBBBBBB", "es", "news"), outcome: "already imported", reason: "", title: "Hoy" },
  { entry: entry(3, "https://youtu.be/CCCCCCCCCCC", "de"), outcome: "skipped", reason: "no captions", title: "" },
  { entry: { line: 4, url: "nope", error: "not a YouTube video link" }, outcome: "invalid", reason: "not a YouTube video link", title: "" },
  { entry: entry(5, "https://youtu.be/DDDDDDDDDDD", "fr"), outcome: "failed", reason: "review unavailable", title: "" },
  { entry: entry(6, "https://youtu.be/EEEEEEEEEEE", "fr"), outcome: "refused", reason: "Graphic violence", title: "" },
  { entry: entry(7, "https://youtu.be/FFFFFFFFFFF", "fr", "news"), outcome: "not run", reason: "token", title: "" },
  { entry: entry(8, "https://youtu.be/GGGGGGGGGGG", "fr"), outcome: "imported", reason: "news", title: "" },
];

test("the summary counts each outcome, in a fixed order, leaving out the ones that didn't happen", () => {
  assert.equal(summary(results),
    "8 lines: 2 imported, 1 already imported, 1 skipped, 1 refused, 1 failed, 1 invalid, 1 not run");
  assert.equal(summary(results.slice(0, 1)), "1 line: 1 imported");
  assert.equal(summary([]), "0 lines");
});

test("the results file is a list file: every line again, with its outcome as a comment", () => {
  assert.equal(resultsFile(results), [
    "https://youtu.be/AAAAAAAAAAA fr  # imported: food — Le marché",
    "https://youtu.be/BBBBBBBBBBB es news  # already imported — Hoy",
    "https://youtu.be/CCCCCCCCCCC de  # skipped: no captions",
    "# nope  # invalid: not a YouTube video link",
    "https://youtu.be/DDDDDDDDDDD fr  # failed: review unavailable",
    "https://youtu.be/EEEEEEEEEEE fr  # refused: Graphic violence",
    "https://youtu.be/FFFFFFFFFFF fr news  # not run: token",
    "https://youtu.be/GGGGGGGGGGG fr  # imported: news",
    "",
  ].join("\n"));
});

test("the retry file holds only the lines worth running again", () => {
  assert.equal(retryFile(results), [
    "https://youtu.be/CCCCCCCCCCC de  # skipped: no captions",
    "https://youtu.be/DDDDDDDDDDD fr  # failed: review unavailable",
    "https://youtu.be/FFFFFFFFFFF fr news  # not run: token",
    "",
  ].join("\n"));
  assert.equal(retryFile(results.slice(0, 2)), "");
});

test("a dry run's summary counts what would be imported", () => {
  const dry = [{ ...results[0], outcome: "would import" }, { ...results[1] }];
  assert.equal(summary(dry), "2 lines: 1 would import, 1 already imported");
});
