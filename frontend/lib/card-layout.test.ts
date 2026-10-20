import { describe, expect, it } from "vitest";
import {
  CARD_LAYOUTS,
  CARD_LAYOUT_COOKIE,
  cardGridClass,
  cardLayoutCookie,
  parseCardLayout,
  shelfCardLayout,
  shelfCardWidth,
  shelfTrackClass,
} from "./card-layout";

describe("parseCardLayout", () => {
  it("accepts the three layouts", () => {
    expect(parseCardLayout("cards")).toBe("cards");
    expect(parseCardLayout("compact")).toBe("compact");
    expect(parseCardLayout("list")).toBe("list");
  });

  it("falls back to cards for missing or unknown values", () => {
    expect(parseCardLayout(undefined)).toBe("cards");
    expect(parseCardLayout(null)).toBe("cards");
    expect(parseCardLayout("")).toBe("cards");
    expect(parseCardLayout("LIST")).toBe("cards");
    expect(parseCardLayout("tiles")).toBe("cards");
    expect(parseCardLayout("toString")).toBe("cards");
  });
});

describe("CARD_LAYOUT_COOKIE", () => {
  it("keeps its name, so layouts already saved in browsers still apply", () => {
    expect(CARD_LAYOUT_COOKIE).toBe("lector_card_layout");
  });
});

describe("cardLayoutCookie", () => {
  it("remembers a non-default layout for a year, site-wide", () => {
    expect(cardLayoutCookie("compact")).toBe(`${CARD_LAYOUT_COOKIE}=compact; Path=/; Max-Age=31536000; SameSite=Lax`);
    expect(cardLayoutCookie("list")).toBe(`${CARD_LAYOUT_COOKIE}=list; Path=/; Max-Age=31536000; SameSite=Lax`);
  });

  it("clears the cookie when going back to the default cards", () => {
    expect(cardLayoutCookie("cards")).toBe(`${CARD_LAYOUT_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`);
  });
});

describe("CARD_LAYOUTS", () => {
  it("lists every layout once, cards first, each with a label", () => {
    expect(CARD_LAYOUTS.map((l) => l.value)).toEqual(["cards", "compact", "list"]);
    expect(CARD_LAYOUTS.map((l) => l.label)).toEqual(["Cards", "Compact", "List"]);
  });
});

describe("cardGridClass", () => {
  it("keeps the original card grid (up to 4 columns)", () => {
    expect(cardGridClass("cards")).toBe("grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4");
  });

  it("packs compact cards into more columns at every width", () => {
    expect(cardGridClass("compact")).toBe("grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6");
  });

  it("stacks list rows in one column", () => {
    expect(cardGridClass("list")).toBe("flex flex-col gap-2");
  });
});

describe("shelf layouts", () => {
  it("keeps every layout on a shelf, so compact and list look different there too", () => {
    expect(shelfCardLayout("cards")).toBe("cards");
    expect(shelfCardLayout("compact")).toBe("compact");
    expect(shelfCardLayout("list")).toBe("list");
  });

  it("makes compact shelf cards narrower than regular ones, and lets list rows take their column's width", () => {
    expect(shelfCardWidth("cards")).toBe("w-64");
    expect(shelfCardWidth("compact")).toBe("w-44");
    expect(shelfCardWidth("list")).toBe("min-w-0");
  });

  it("scrolls cards and compact cards sideways in one line", () => {
    const line = "-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pb-3 sm:mx-0 sm:scroll-px-0 sm:px-0";
    expect(shelfTrackClass("cards", 12)).toBe(line);
    expect(shelfTrackClass("compact", 12)).toBe(line);
  });

  it("stacks list rows three high, in columns that scroll sideways", () => {
    expect(shelfTrackClass("list", 12)).toBe(
      "-mx-4 grid grid-flow-col auto-cols-[min(24rem,calc(100vw-3rem))] grid-rows-3 snap-x snap-mandatory scroll-px-4 gap-x-4 gap-y-2 overflow-x-auto px-4 pb-3 sm:mx-0 sm:scroll-px-0 sm:px-0",
    );
  });

  it("uses only as many list rows as there are items, up to three", () => {
    expect(shelfTrackClass("list", 1)).toContain(" grid-rows-1 ");
    expect(shelfTrackClass("list", 2)).toContain(" grid-rows-2 ");
    expect(shelfTrackClass("list", 3)).toContain(" grid-rows-3 ");
    expect(shelfTrackClass("list", 0)).toContain(" grid-rows-1 ");
  });
});
