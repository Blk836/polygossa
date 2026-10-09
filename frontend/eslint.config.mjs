import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      complexity: ["error", 10],
      "max-lines": ["error", { max: 300, skipBlankLines: false, skipComments: false }],
    },
  },
  globalIgnores([
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
