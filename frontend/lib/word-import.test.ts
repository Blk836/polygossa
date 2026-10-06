import { describe, expect, it } from "vitest";
import { anyActive, importHeadline, importCounts, isActive, type WordImportJob } from "./word-import";

const job = (over: Partial<WordImportJob> = {}): WordImportJob => ({
  id: 1,
  source: "lingq",
  language: "fr",
  state: "done",
  found: 254,
  added: 250,
  updated: 3,
  unchanged: 1,
  overLimit: 0,
  error: null,
  createdAt: "2026-10-05T10:00:00Z",
  finishedAt: "2026-10-05T10:01:00Z",
  ...over,
});

describe("isActive / anyActive", () => {
  it.each([
    ["queued", true],
    ["running", true],
    ["done", false],
    ["failed", false],
  ] as const)("%s is active: %s", (state, active) => {
    expect(isActive(job({ state }))).toBe(active);
  });

  it("is true when any import is still going", () => {
    expect(anyActive([job(), job({ state: "running" })])).toBe(true);
    expect(anyActive([job(), job({ state: "failed" })])).toBe(false);
    expect(anyActive([])).toBe(false);
  });
});

describe("importHeadline", () => {
  it("names the source and language", () => {
    expect(importHeadline(job())).toBe("LingQ · French · Done");
    expect(importHeadline(job({ source: "readlang", language: "ja", state: "failed" }))).toBe("Readlang · Japanese · Failed");
  });

  it("says every language when none was chosen, and Importing… while going", () => {
    expect(importHeadline(job({ language: null, state: "running" }))).toBe("LingQ · All languages · Importing…");
    expect(importHeadline(job({ state: "queued" }))).toBe("LingQ · French · Importing…");
  });

  it("falls back to the code for a language it doesn't know", () => {
    expect(importHeadline(job({ language: "xx" }))).toBe("LingQ · xx · Done");
  });
});

describe("importCounts", () => {
  it("lists found, added, updated and unchanged", () => {
    expect(importCounts(job())).toBe("254 found · 250 added · 3 updated · 1 unchanged");
  });

  it("mentions words over the plan limit only when there are some", () => {
    expect(importCounts(job({ overLimit: 20 }))).toBe("254 found · 250 added · 3 updated · 1 unchanged · 20 over the Free plan's limit");
  });

  it("shows words found so far while running", () => {
    expect(importCounts(job({ state: "running", found: 400, added: 400, updated: 0, unchanged: 0 })))
      .toBe("400 found · 400 added · 0 updated · 0 unchanged");
  });
});
