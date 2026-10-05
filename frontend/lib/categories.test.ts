import { describe, expect, it } from "vitest";
import { CATEGORIES, categoriesIn, categoryInfo, categoryLabel, exploreQuery, gridHeading, isCategory } from "./categories";
import type { Category, TextSummary } from "./types";

describe("CATEGORIES", () => {
  it("matches the backend's fixed list and order, other last", () => {
    expect(CATEGORIES.map((c) => c.code)).toEqual([
      "learners", "daily-life", "stories", "news", "culture", "travel", "food", "science", "history", "entertainment", "other",
    ]);
  });

  it("gives every category a label and a one-line blurb", () => {
    for (const c of CATEGORIES) {
      expect(c.label.length).toBeGreaterThan(2);
      expect(c.blurb.length).toBeGreaterThan(10);
    }
  });
});

describe("categoryLabel / categoryInfo", () => {
  it("names known categories", () => {
    expect(categoryLabel("learners")).toBe("For learners");
    expect(categoryLabel("daily-life")).toBe("Everyday life");
    expect(categoryInfo("food")?.code).toBe("food");
  });

  it("falls back to Other for unknown or missing values", () => {
    expect(categoryLabel(undefined)).toBe("Other");
    expect(categoryLabel("sports")).toBe("Other");
    expect(categoryInfo("sports")).toBeUndefined();
  });
});

describe("isCategory", () => {
  it("accepts only the fixed codes", () => {
    expect(isCategory("news")).toBe(true);
    expect(isCategory("other")).toBe(true);
    expect(isCategory("News")).toBe(false);
    expect(isCategory("")).toBe(false);
    expect(isCategory(null)).toBe(false);
  });
});

describe("categoriesIn", () => {
  const item = (category: Category) => ({ category }) as TextSummary;

  it("lists the categories present, in the fixed order, once each", () => {
    expect(categoriesIn([item("food"), item("learners"), item("food"), item("other")])).toEqual(["learners", "food", "other"]);
  });

  it("is empty for an empty list", () => {
    expect(categoriesIn([])).toEqual([]);
  });
});

describe("exploreQuery", () => {
  it("builds the grid query with only the filters that are set", () => {
    expect(exploreQuery({ language: "fr", category: "food", level: "", kind: "all", sort: "new", query: "", page: 0 }, 24))
      .toBe("library?sort=new&page=0&size=24&language=fr&category=food");
    expect(exploreQuery({ language: "", category: null, level: "B1", kind: "video", sort: "popular", query: "café", page: 2 }, 24))
      .toBe("library?sort=popular&page=2&size=24&level=B1&kind=video&q=caf%C3%A9");
  });

  it("builds the shelves query without paging, sorting or search", () => {
    expect(exploreQuery({ language: "ja", category: null, level: "A2", kind: "text", sort: "new", query: "", page: 0 }, 24, true))
      .toBe("library/shelves?language=ja&level=A2&kind=text");
    expect(exploreQuery({ language: "", category: null, level: "", kind: "all", sort: "new", query: "", page: 0 }, 24, true))
      .toBe("library/shelves");
  });
});

describe("gridHeading", () => {
  it("is just All with nothing chosen", () => {
    expect(gridHeading("", null, 5)).toEqual({ title: "All", subtitle: "" });
  });

  it("names a category with its blurb", () => {
    expect(gridHeading("", "food", 12)).toEqual({ title: "Food & cooking", subtitle: "Markets, recipes and meals with family" });
  });

  it("quotes a search and counts the results, mentioning the category when one is chosen", () => {
    expect(gridHeading("café", null, 3)).toEqual({ title: "“café”", subtitle: "3 results" });
    expect(gridHeading("café", "travel", 1)).toEqual({ title: "“café”", subtitle: "1 result in Travel" });
    expect(gridHeading("café", null, null)).toEqual({ title: "“café”", subtitle: "Searching…" });
  });
});

describe("topic filter (AI topic tags)", () => {
  const f = { language: "fr", category: null, level: "", kind: "all" as const, sort: "new" as const, query: "", page: 0 };

  it("adds the topic to the grid query, never to the shelves", () => {
    expect(exploreQuery({ ...f, topic: "climate change" }, 24)).toBe("library?sort=new&page=0&size=24&language=fr&topic=climate+change");
    expect(exploreQuery({ ...f, topic: "cooking" }, 24, true)).toBe("library/shelves?language=fr");
    expect(exploreQuery({ ...f, topic: null }, 24)).toBe("library?sort=new&page=0&size=24&language=fr");
  });

  it("heads the grid with the topic and how many items have it", () => {
    expect(gridHeading("", null, 3, "cooking")).toEqual({ title: "cooking", subtitle: "3 items about cooking" });
    expect(gridHeading("", null, 1, "cooking")).toEqual({ title: "cooking", subtitle: "1 item about cooking" });
    expect(gridHeading("", null, null, "cooking")).toEqual({ title: "cooking", subtitle: "Items about cooking" });
  });

  it("lets a search win over the topic", () => {
    expect(gridHeading("café", null, 3, "cooking")).toEqual({ title: "“café”", subtitle: "3 results" });
  });
});
