import { describe, expect, it } from "vitest";
import {
  areaWords,
  bandsUpTo,
  bandView,
  coverage,
  defaultTopBand,
  drawnMap,
  mapWords,
  nextBand,
  placeOf,
  placeParam,
  regionWords,
  ringScale,
  storedTopBand,
  tileStats,
  withStatus,
} from "./vocab-map";
import type { VocabMap, VocabMapWord } from "./types";

const word = (term: string, band: string, status: VocabMapWord["status"] = null): VocabMapWord => ({
  term,
  band,
  status,
  meaning: null,
});

const map: VocabMap = {
  language: "fr",
  available: true,
  readingLevel: null,
  bands: ["A1", "A2", "B1"],
  meaningLanguage: "en",
  beyondCore: 0,
  regions: [
    {
      id: "food",
      name: "Food & Drink",
      areas: [
        { id: "fruit-veg", name: "Fruit & vegetables", words: [word("pomme", "A1", "known"), word("poire", "A2")] },
        { id: "drinks", name: "Drinks", words: [word("eau", "A1")] },
      ],
    },
    { id: "home", name: "Home", areas: [{ id: "rooms", name: "Rooms", words: [word("lit", "B1", "learning")] }] },
  ],
};

describe("defaultTopBand", () => {
  it("counts up to the learner's Reading level", () => {
    expect(defaultTopBand("A2", ["A1", "A2", "B1"])).toBe("A2");
    expect(defaultTopBand("B1", ["A1", "A2", "B1"])).toBe("B1");
  });

  it("starts at A1 without a level", () => {
    expect(defaultTopBand(null, ["A1", "A2", "B1"])).toBe("A1");
  });

  it("stops at the list's highest band for a learner above it", () => {
    expect(defaultTopBand("C1", ["A1", "A2", "B1"])).toBe("B1");
    expect(defaultTopBand("C2", ["A1", "A2", "B1"])).toBe("B1");
  });

  it("counts up to B2 for a B2 reader and up to C1 for a C2 reader when the list reaches C1", () => {
    const all = ["A1", "A2", "B1", "B2", "C1"];
    expect(defaultTopBand("B2", all)).toBe("B2");
    expect(defaultTopBand("C2", all)).toBe("C1");
  });

  it("treats an unknown level as none", () => {
    expect(defaultTopBand("Z9", ["A1", "A2"])).toBe("A1");
  });

  it("has nothing to count without bands", () => {
    expect(defaultTopBand("A2", [])).toBeNull();
  });
});

describe("storedTopBand", () => {
  it("keeps a stored band the list has", () => {
    expect(storedTopBand("B1", ["A1", "A2", "B1"])).toBe("B1");
  });

  it("drops a band the list no longer has, or nothing stored", () => {
    expect(storedTopBand("B2", ["A1", "A2", "B1"])).toBeNull();
    expect(storedTopBand(null, ["A1"])).toBeNull();
  });
});

describe("bandsUpTo", () => {
  it("includes every band up to and including the top one", () => {
    expect(bandsUpTo("A2", ["A1", "A2", "B1"])).toEqual(["A1", "A2"]);
    expect(bandsUpTo("A1", ["A1", "A2", "B1"])).toEqual(["A1"]);
    expect(bandsUpTo("B1", ["A1", "A2", "B1"])).toEqual(["A1", "A2", "B1"]);
  });
});

describe("nextBand", () => {
  it("is the band after the top one when the list has it", () => {
    expect(nextBand("A2", ["A1", "A2", "B1"])).toEqual({ band: "B1", soon: false });
  });

  it("is coming soon when the list stops at the top band", () => {
    expect(nextBand("B1", ["A1", "A2", "B1"])).toEqual({ band: "B2", soon: true });
  });

  it("is nothing after C1", () => {
    expect(nextBand("C1", ["A1", "A2", "B1", "B2", "C1"])).toBeNull();
  });
});

describe("bandView", () => {
  it("counts up to the top band and shows the next one faintly", () => {
    expect(bandView("A2", ["A1", "A2", "B1"])).toEqual({ shown: ["A1", "A2"], next: "B1", soon: null });
  });

  it("says the next band is coming soon when the list stops at the top band", () => {
    expect(bandView("B1", ["A1", "A2", "B1"])).toEqual({ shown: ["A1", "A2", "B1"], next: null, soon: "B2" });
  });

  it("has neither after C1", () => {
    expect(bandView("C1", ["A1", "A2", "B1", "B2", "C1"])).toEqual({ shown: ["A1", "A2", "B1", "B2", "C1"], next: null, soon: null });
  });
});

describe("tileStats", () => {
  const words = [
    word("a", "A1", "known"),
    word("b", "A1", "learning"),
    word("c", "A1"),
    word("d", "A2", "known"),
    word("e", "A1", "ignored"),
    word("f", "B1"),
    word("g", "B1", "known"),
  ];

  it("counts known, learning and total over the shown bands only", () => {
    expect(tileStats(words, ["A1"], "A2")).toEqual({ known: 1, learning: 1, total: 3, next: 1 });
    expect(tileStats(words, ["A1", "A2"], "B1")).toEqual({ known: 2, learning: 1, total: 4, next: 2 });
  });

  it("leaves ignored words out of the total and the next band", () => {
    expect(tileStats([word("e", "A1", "ignored"), word("h", "A2", "ignored")], ["A1"], "A2"))
      .toEqual({ known: 0, learning: 0, total: 0, next: 0 });
  });

  it("has no next band count when there is none", () => {
    expect(tileStats(words, ["A1", "A2", "B1"], null).next).toBe(0);
  });
});

describe("coverage", () => {
  it("is the per cent known, rounded", () => {
    expect(coverage({ known: 1, learning: 0, total: 3, next: 0 })).toBe(33);
    expect(coverage({ known: 2, learning: 0, total: 3, next: 0 })).toBe(67);
    expect(coverage({ known: 3, learning: 0, total: 3, next: 0 })).toBe(100);
  });

  it("is zero for an empty tile", () => {
    expect(coverage({ known: 0, learning: 0, total: 0, next: 0 })).toBe(0);
  });
});

describe("regionWords and mapWords", () => {
  it("gather the words of every area", () => {
    expect(regionWords(map.regions[0]).map((w) => w.term)).toEqual(["pomme", "poire", "eau"]);
    expect(mapWords(map).map((w) => w.term)).toEqual(["pomme", "poire", "eau", "lit"]);
  });
});

describe("placeOf", () => {
  it("finds a region and an area", () => {
    const place = placeOf("food/drinks", map);
    expect(place.region?.id).toBe("food");
    expect(place.area?.id).toBe("drinks");
  });

  it("finds a region alone", () => {
    const place = placeOf("home", map);
    expect(place.region?.id).toBe("home");
    expect(place.area).toBeNull();
  });

  it("opens the whole map for nothing or an unknown region", () => {
    expect(placeOf(null, map)).toEqual({ region: null, area: null });
    expect(placeOf("space/stars", map)).toEqual({ region: null, area: null });
  });

  it("keeps the region when only the area is unknown", () => {
    const place = placeOf("food/rooms", map);
    expect(place.region?.id).toBe("food");
    expect(place.area).toBeNull();
  });
});

describe("placeParam", () => {
  it("names the region, then the area", () => {
    expect(placeParam("food")).toBe("food");
    expect(placeParam("food", "drinks")).toBe("food/drinks");
  });

  it("is nothing for the whole map", () => {
    expect(placeParam(null)).toBeNull();
    expect(placeParam(null, "drinks")).toBeNull();
  });
});

describe("withStatus", () => {
  it("changes one word's status and leaves the rest", () => {
    const changed = withStatus(map, "poire", "learning");
    expect(mapWords(changed).map((w) => w.status)).toEqual(["known", "learning", null, "learning"]);
    expect(mapWords(map)[1].status).toBeNull();
  });
});

describe("areaWords", () => {
  const area = { id: "x", name: "X", words: [word("b1", "B1"), word("a1", "A1"), word("a2", "A2"), word("b2", "B2")] };

  it("lists the shown bands' words, then the next band's as faint", () => {
    expect(areaWords(area, ["A1", "A2"], "B1").map(({ word: w, faint }) => `${w.term}${faint ? "*" : ""}`))
      .toEqual(["a1", "a2", "b1*"]);
  });

  it("has no faint words without a next band", () => {
    expect(areaWords(area, ["A1"], null).map(({ word: w }) => w.term)).toEqual(["a1"]);
  });
});

describe("ringScale", () => {
  const all = ["A1", "A2", "B1", "B2", "C1"];

  it("draws the countries closer round Core for the small island of the first band, the same in every language", () => {
    expect(ringScale(bandView("A1", all))).toBeCloseTo(0.66, 2);
    expect(ringScale(bandView("A1", ["A1", "A2", "B1"]))).toBe(ringScale(bandView("A1", all)));
  });

  it("keeps the full ring from B2 up, and grows with the band below that", () => {
    const scales = all.map((top) => ringScale(bandView(top, all)));
    expect(scales.slice(2)).toEqual([1, 1, 1]);
    expect(scales[0]).toBeLessThan(scales[1]);
    expect(scales[1]).toBeLessThan(1);
  });
});

describe("drawnMap", () => {
  const terms = (m: VocabMap) => m.regions.map((r) => `${r.id}: ${r.areas.map((a) => `${a.id}=${a.words.map((w) => w.term).join(",")}`).join(" ")}`);

  it("keeps the words up to the next band, and leaves later bands out", () => {
    expect(terms(drawnMap(map, bandView("A1", ["A1", "A2", "B1"])))).toEqual(["food: fruit-veg=pomme,poire drinks=eau"]);
  });

  it("leaves out an area, and a region, with no words up to the next band", () => {
    const wider = { ...map, regions: [...map.regions, { id: "work", name: "Work", areas: [
      { id: "jobs", name: "Jobs", words: [word("travail", "A2")] },
      { id: "office", name: "Office", words: [word("bureau", "B1")] },
    ] }] };
    expect(terms(drawnMap(wider, bandView("A1", ["A1", "A2", "B1"])))).toEqual(["food: fruit-veg=pomme,poire drinks=eau", "work: jobs=travail"]);
  });

  it("keeps every word at the top band, and each word's status", () => {
    expect(mapWords(drawnMap(map, bandView("B1", ["A1", "A2", "B1"])))).toEqual(mapWords(map));
  });

  it("keeps only the shown bands when the next one is coming soon", () => {
    expect(terms(drawnMap(map, bandView("A2", ["A1", "A2"])))).toEqual(["food: fruit-veg=pomme,poire drinks=eau"]);
  });
});
