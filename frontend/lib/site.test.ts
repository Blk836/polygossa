import { describe, expect, it } from "vitest";
import { appUrl } from "./site";

describe("appUrl", () => {
  it("is APP_URL without trailing slashes", () => {
    expect(appUrl({ APP_URL: "https://site.example/" })).toBe("https://site.example");
    expect(appUrl({ APP_URL: "  https://site.example//  " })).toBe("https://site.example");
  });

  it("falls back to the local dev server when APP_URL is unset or blank", () => {
    expect(appUrl({})).toBe("http://localhost:3000");
    expect(appUrl({ APP_URL: "   " })).toBe("http://localhost:3000");
  });
});
