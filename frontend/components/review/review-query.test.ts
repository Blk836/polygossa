import { describe, expect, it } from "vitest";
import { RATING_KEYS, query } from "./review-query";

describe("review query", () => {
  it("adds the language filter only when one is chosen", () => {
    expect(query("")).toBe("");
    expect(query("es")).toBe("?language=es");
    expect(query("", { limit: "50", ahead: "false" })).toBe("?limit=50&ahead=false");
    expect(query("ja", { limit: "50" })).toBe("?limit=50&language=ja");
  });
});

describe("rating keys", () => {
  it("maps 1-3 to forgot, hard, easy", () => {
    expect(RATING_KEYS).toEqual({ "1": "forgot", "2": "hard", "3": "easy" });
  });
});
