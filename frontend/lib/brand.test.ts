import { describe, expect, it } from "vitest";
import { brandName, DEFAULT_BRAND } from "./brand";

describe("brandName", () => {
  it("defaults to Polygossa", () => {
    expect(DEFAULT_BRAND).toBe("Polygossa");
    expect(brandName(undefined)).toBe("Polygossa");
  });

  it("treats a blank setting as unset", () => {
    expect(brandName("")).toBe("Polygossa");
    expect(brandName("   ")).toBe("Polygossa");
  });

  it("uses the configured name, trimmed", () => {
    expect(brandName("Acme Read")).toBe("Acme Read");
    expect(brandName("  Acme  ")).toBe("Acme");
  });
});
