const config = {
  testRunner: "command",
  commandRunner: { command: 'node --test "tools/**/*.test.mjs"' },
  mutate: ["tools/import-videos/*.mjs", "!tools/import-videos/*.test.mjs", "tools/ci-checks/*.mjs", "!tools/ci-checks/*.test.mjs",
    "tools/local-checks/*.mjs", "!tools/local-checks/*.test.mjs"],
  ignorePatterns: ["/*", "!/tools"],
  reporters: ["clear-text", "progress"],
  thresholds: { high: 90, low: 80, break: 80 },
  tempDirName: "tools/.stryker-tmp",
  coverageAnalysis: "off",
};

export default config;
