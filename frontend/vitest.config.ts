import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  test: {
    include: ["**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**", ".stryker-tmp/**"],
    environment: "node",
    // Defined (blank = default brand) so lib/brand.ts's import-time brandName() call can't crash a mutant before its
    // tests run, which Stryker would score as survived.
    env: { BRAND_NAME: "" },
  },
});
