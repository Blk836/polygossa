import { describe, expect, it } from "vitest";
import { sectionTourName } from "./nav";
import { pendingTour, placeCard, sameRect, stepLabel, TOURS, tourFor, visibleRect, withSeen, type Rect } from "./tours";

describe("tourFor", () => {
  it.each([
    ["/library", "library"],
    ["/community", "explore"],
    ["/import", "import"],
    ["/playlists", "playlists"],
    ["/read/12", "reader"],
    ["/review", "review"],
    ["/vocabulary", "words"],
    ["/writing", "writing"],
    ["/dashboard", "progress"],
    ["/forum", "forum"],
  ])("%s has the %s tour", (path, key) => {
    expect(tourFor(path)?.key).toBe(key);
  });

  it.each(["/library/saved", "/playlists/4", "/read", "/forum/7", "/forum/new", "/onboarding", "/settings", "/classes", "/admin", "/", "/libraryx"])(
    "%s has no tour",
    (path) => {
      expect(tourFor(path)).toBeUndefined();
    },
  );
});

describe("the tours themselves", () => {
  it("have unique names the server accepts", () => {
    const keys = TOURS.map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) expect(key).toMatch(/^[a-z][a-z-]{0,29}$/);
  });

  it("are short: one to three tips of one or two short sentences", () => {
    for (const tour of TOURS) {
      expect(tour.steps.length).toBeGreaterThanOrEqual(1);
      expect(tour.steps.length).toBeLessThanOrEqual(3);
      for (const step of tour.steps) {
        expect(step.title.length).toBeGreaterThan(0);
        expect(step.title.length).toBeLessThanOrEqual(40);
        expect(step.body.length).toBeGreaterThan(0);
        expect(step.body.length).toBeLessThanOrEqual(170);
      }
    }
  });

  it("point at the Library's two sub-tabs, not the old Saved tab or Shared switch", () => {
    const targets = TOURS.flatMap((t) => t.steps.map((s) => s.target));
    expect(targets).toContain("explore");
    expect(targets).not.toContain("saved");
    expect(targets).not.toContain("playlist-tabs");
    const keep = TOURS.find((t) => t.key === "explore")!.steps.find((s) => s.title === "Keep it for later")!;
    expect(keep.target).toBe(sectionTourName("My library"));
    expect(keep.body).toContain("My library");
  });

  it("point at controls by data-tour name", () => {
    for (const step of TOURS.flatMap((t) => t.steps)) {
      if (step.target !== undefined) expect(step.target).toMatch(/^[a-z][a-z-]*$/);
    }
  });
});

describe("pendingTour", () => {
  const everything = { pro: true, language: true };

  it("is the page's tour while tours are on and it isn't seen yet", () => {
    expect(pendingTour("/library", { on: true, seen: [] }, everything)?.key).toBe("library");
    expect(pendingTour("/library", { on: true, seen: ["reader"] }, everything)?.key).toBe("library");
  });

  it("is nothing once seen, with tours off, or on a page without one", () => {
    expect(pendingTour("/library", { on: true, seen: ["library"] }, everything)).toBeNull();
    expect(pendingTour("/library", { on: false, seen: [] }, everything)).toBeNull();
    expect(pendingTour("/settings", { on: true, seen: [] }, everything)).toBeNull();
  });

  it("waits while the page is locked: Review and Write need Pro, Write a language too", () => {
    const tours = { on: true, seen: [] };
    expect(pendingTour("/review", tours, { pro: false, language: true })).toBeNull();
    expect(pendingTour("/review", tours, { pro: true, language: false })?.key).toBe("review");
    expect(pendingTour("/writing", tours, { pro: false, language: true })).toBeNull();
    expect(pendingTour("/writing", tours, { pro: true, language: false })).toBeNull();
    expect(pendingTour("/writing", tours, everything)?.key).toBe("writing");
  });

  it("doesn't lock pages that work on every plan and without a language", () => {
    const tours = { on: true, seen: [] };
    const none = { pro: false, language: false };
    for (const tour of TOURS.filter((t) => t.key !== "review" && t.key !== "writing")) {
      const path = tour.path.endsWith("/") ? `${tour.path}1` : tour.path;
      expect(pendingTour(path, tours, none)?.key).toBe(tour.key);
    }
  });
});

describe("withSeen", () => {
  it("adds a tour once, keeping the rest", () => {
    expect(withSeen({ on: true, seen: ["reader"] }, "library")).toEqual({ on: true, seen: ["reader", "library"] });
    expect(withSeen({ on: true, seen: ["library"] }, "library")).toEqual({ on: true, seen: ["library"] });
  });
});

describe("stepLabel", () => {
  it("counts from one", () => {
    expect(stepLabel(0, 3)).toBe("1 of 3");
    expect(stepLabel(2, 3)).toBe("3 of 3");
  });
});

describe("visibleRect", () => {
  it("is the box when it has a size, else nothing", () => {
    expect(visibleRect({ top: 1, left: 2, width: 3, height: 4 })).toEqual({ top: 1, left: 2, width: 3, height: 4 });
    expect(visibleRect({ top: 1, left: 2, width: 0, height: 4 })).toBeNull();
    expect(visibleRect({ top: 1, left: 2, width: 3, height: 0 })).toBeNull();
    expect(visibleRect(null)).toBeNull();
  });
});

describe("sameRect", () => {
  const a: Rect = { top: 10, left: 20, width: 30, height: 40 };
  it("ignores sub-pixel changes", () => {
    expect(sameRect(a, { top: 10.4, left: 20.2, width: 30.3, height: 39.8 })).toBe(true);
    expect(sameRect(null, null)).toBe(true);
  });
  it("notices a move or a size change, or a box appearing", () => {
    expect(sameRect(a, { ...a, top: 12 })).toBe(false);
    expect(sameRect(a, { ...a, left: 22 })).toBe(false);
    expect(sameRect(a, { ...a, width: 32 })).toBe(false);
    expect(sameRect(a, { ...a, height: 42 })).toBe(false);
    expect(sameRect(a, null)).toBe(false);
    expect(sameRect(null, a)).toBe(false);
  });
});

describe("placeCard", () => {
  const card = { width: 300, height: 150 };
  const desktop = { width: 1200, height: 800 };
  const phone = { width: 390, height: 800 };

  it("goes under the control, centred on it", () => {
    expect(placeCard({ top: 100, left: 500, width: 100, height: 40 }, card, desktop)).toEqual({ top: 152, left: 400 });
  });

  it("goes over the control when there's no room under it", () => {
    expect(placeCard({ top: 600, left: 500, width: 100, height: 40 }, card, desktop)).toEqual({ top: 438, left: 400 });
  });

  it("just fits under, or over, at the edge", () => {
    // under: 100 + 40 + 12 + 150 = 302 must leave the 12px margin: viewport 314 fits exactly
    expect(placeCard({ top: 100, left: 500, width: 100, height: 40 }, card, { width: 1200, height: 314 }).top).toBe(152);
    expect(placeCard({ top: 100, left: 500, width: 100, height: 40 }, card, { width: 1200, height: 313 }).top).not.toBe(152);
    // over: 174 - 12 - 150 = 12, exactly the margin
    expect(placeCard({ top: 174, left: 500, width: 100, height: 600 }, card, desktop).top).toBe(12);
  });

  it("stays inside the screen sideways", () => {
    expect(placeCard({ top: 100, left: 0, width: 40, height: 40 }, card, desktop).left).toBe(12);
    expect(placeCard({ top: 100, left: 1180, width: 20, height: 40 }, card, desktop).left).toBe(888);
  });

  it("sits at the bottom, centred, with no control or one too big to go around", () => {
    expect(placeCard(null, card, desktop)).toEqual({ top: 626, left: 450 });
    expect(placeCard({ top: 20, left: 0, width: 1200, height: 760 }, card, desktop)).toEqual({ top: 626, left: 450 });
  });

  it("stays above the phone tab bar", () => {
    expect(placeCard(null, card, phone)).toEqual({ top: 570, left: 45 });
  });

  it("never starts above the screen when the card is taller than it", () => {
    expect(placeCard(null, { width: 300, height: 900 }, desktop).top).toBe(12);
  });
});
