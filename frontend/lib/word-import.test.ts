import { describe, expect, it } from "vitest";
import { anyActive, importButtonLabel, importHeadline, importCounts, isActive, type WordImportJob } from "./word-import";

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

describe("importCounts before the first words arrive", () => {
  it.each(["queued", "running"] as const)("says it is fetching while %s with nothing found yet", (state) => {
    const empty = { state, found: 0, added: 0, updated: 0, unchanged: 0 };
    expect(importCounts(job(empty))).toBe("Fetching your words from LingQ…");
    expect(importCounts(job({ ...empty, source: "readlang" }))).toBe("Fetching your words from Readlang…");
  });

  it("shows the counts once a word is found, and for a finished import with none", () => {
    expect(importCounts(job({ state: "running", found: 1, added: 1, updated: 0, unchanged: 0 })))
      .toBe("1 found · 1 added · 0 updated · 0 unchanged");
    expect(importCounts(job({ state: "done", found: 0, added: 0, updated: 0, unchanged: 0 })))
      .toBe("0 found · 0 added · 0 updated · 0 unchanged");
    expect(importCounts(job({ state: "failed", found: 0, added: 0, updated: 0, unchanged: 0 })))
      .toBe("0 found · 0 added · 0 updated · 0 unchanged");
  });
});

describe("importButtonLabel", () => {
  it("names the source when idle", () => {
    expect(importButtonLabel("lingq", "idle")).toBe("Import from LingQ");
    expect(importButtonLabel("readlang", "idle")).toBe("Import from Readlang");
  });

  it("says Starting… while the start is sent, and Importing… while one runs", () => {
    expect(importButtonLabel("lingq", "starting")).toBe("Starting…");
    expect(importButtonLabel("readlang", "busy")).toBe("Importing…");
  });
});
