// Mutation testing for tools/ with the frontend's Stryker install, run from the repo root:
//   frontend/node_modules/.bin/stryker run tools/stryker.config.mjs
// The "command" runner reruns Node's own test runner against each mutant, so tools/ needs no packages of its own.
/** @type {import("@stryker-mutator/api/core").PartialStrykerOptions} */
const config = {
  testRunner: "command",
  commandRunner: { command: 'node --test "tools/**/*.test.mjs"' },
  mutate: ["tools/import-videos/*.mjs", "!tools/import-videos/*.test.mjs"],
  // Copy only tools/ into the sandbox, not the whole repo.
  ignorePatterns: ["/*", "!/tools"],
  reporters: ["clear-text", "progress"],
  thresholds: { high: 90, low: 80, break: 80 },
  tempDirName: "tools/.stryker-tmp",
  coverageAnalysis: "off",
};

export default config;
