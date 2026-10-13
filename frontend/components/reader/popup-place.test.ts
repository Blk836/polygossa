import { describe, expect, it } from "vitest";
import { popupLeft, popupTop } from "./popup-place";

const view = { top: 0, bottom: 720 };

describe("popupTop", () => {
  it("opens 8 px below the word when the card fits there", () => {
    expect(popupTop({ top: 100, bottom: 130 }, 300, view)).toBe(138);
  });

  it("opens below when the card ends exactly at the bottom of the view", () => {
    expect(popupTop({ top: 382, bottom: 412 }, 300, view)).toBe(420);
  });

  it("opens with its bottom 8 px above the word when it doesn't fit below", () => {
    expect(popupTop({ top: 600, bottom: 630 }, 300, view)).toBe(292);
  });

  it("opens above when the card starts exactly at the top of the view", () => {
    expect(popupTop({ top: 308, bottom: 600 }, 300, view)).toBe(0);
  });

  it("measures the room below from the top of a docked player, not the window's bottom", () => {
    expect(popupTop({ top: 350, bottom: 380 }, 300, view)).toBe(388);
    expect(popupTop({ top: 350, bottom: 380 }, 300, { top: 0, bottom: 600 })).toBe(42);
  });

  it("is pushed up just enough to end at the bottom of the view when it fits neither way", () => {
    expect(popupTop({ top: 200, bottom: 230 }, 300, { top: 0, bottom: 400 })).toBe(100);
  });

  it("never starts above the top of the view, even when taller than it", () => {
    expect(popupTop({ top: 200, bottom: 230 }, 500, { top: 0, bottom: 400 })).toBe(0);
  });

  it("works in a view that doesn't start at 0", () => {
    expect(popupTop({ top: 200, bottom: 230 }, 300, { top: 100, bottom: 450 })).toBe(150);
  });
});

describe("popupLeft", () => {
  it("lines up with the word's left edge", () => {
    expect(popupLeft(40, 352, 900)).toBe(40);
  });

  it("is kept inside the text column on the right", () => {
    expect(popupLeft(800, 352, 900)).toBe(548);
  });

  it("is kept inside the text column on the left", () => {
    expect(popupLeft(-10, 352, 900)).toBe(0);
  });
});
