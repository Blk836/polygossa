import { describe, expect, it } from "vitest";
import { NEAR_PX, nearWords } from "./near-words";

const box = (index: number, left: number, top: number, width = 40, height = 20) => ({ index, left, top, right: left + width, bottom: top + height });

describe("nearWords", () => {
  it("reaches 60 px from a word's edges", () => {
    expect(NEAR_PX).toBe(60);
    const word = box(1, 100, 100);
    expect(nearWords(80, 110, [word])).toEqual([1]);
    expect(nearWords(200, 110, [word])).toEqual([1]);
    expect(nearWords(201, 110, [word])).toEqual([]);
    expect(nearWords(120, 39, [word])).toEqual([]);
    expect(nearWords(120, 40, [word])).toEqual([1]);
  });

  it("measures to the nearest corner diagonally", () => {
    const word = box(1, 100, 100);
    expect(nearWords(100 - 42, 100 - 42, [word])).toEqual([1]);
    expect(nearWords(100 - 43, 100 - 43, [word])).toEqual([]);
  });

  it("counts a pointer on the word as nearest", () => {
    expect(nearWords(120, 110, [box(2, 170, 100), box(1, 100, 100)])).toEqual([1, 2]);
  });

  it("lists every word in reach, nearest first", () => {
    const words = [box(5, 300, 100), box(3, 150, 100), box(4, 200, 100), box(9, 100, 400)];
    expect(nearWords(130, 110, words)).toEqual([3, 4]);
    expect(nearWords(260, 110, words)).toEqual([4, 5, 3]);
  });
});
