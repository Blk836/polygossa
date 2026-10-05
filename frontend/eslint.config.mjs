import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Gauntlet limits (see CLAUDE.md): cyclomatic complexity <= 10 per function, <= 300 lines per file.
  {
    rules: {
      complexity: ["error", 10],
      "max-lines": ["error", { max: 300, skipBlankLines: false, skipComments: false }],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "reports/**",
    ".stryker-tmp/**",
    "test-results/**",
    "playwright-report/**",
  ]),
]);

export default eslintConfig;
