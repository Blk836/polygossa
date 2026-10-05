// Mutation testing (npm run mutate). Covers the modules with unit tests: the reader's text, transcript, paging
// (and fitting pages to the screen), settings and audio logic, word colour classes, vocabulary/review query helpers and the API client,
// library media helpers, the video playback clock and YouTube play states, categories, theme, card layout and card status (difficulty, reading progress), playlists, the header nav and its streak/known-words figures, library filters, brand name, progress (streak, milestones, calendar) and writing tests. React components are covered by the
// Playwright suite (e2e/) instead.
/** @type {import("@stryker-mutator/api/core").PartialStrykerOptions} */
const config = {
  testRunner: "vitest",
  plugins: ["@stryker-mutator/vitest-runner"],
  mutate: [
    "lib/api.ts",
    "lib/brand.ts",
    "lib/progress.ts",
    "lib/media.ts",
    "lib/theme.ts",
    "lib/card-layout.ts",
    "lib/card-status.ts",
    "lib/categories.ts",
    "lib/writing.ts",
    "lib/playlists.ts",
    "lib/nav.ts",
    "lib/header-stats.ts",
    "lib/library-filters.ts",
    "components/reader/reader-text.ts",
    "components/reader/audio-sync.ts",
    "components/reader/reader-pages.ts",
    "components/reader/reader-fit.ts",
    "components/reader/reader-transcript.ts",
    "components/reader/reader-settings.ts",
    "components/reader/media-nav.ts",
    "components/reader/media-clock.ts",
    "components/reader/youtube-playback.ts",
    "components/reader/word-class.ts",
    "components/vocabulary/search.ts",
    "components/review/review-query.ts",
  ],
  reporters: ["clear-text", "progress", "html"],
  htmlReporter: { fileName: "reports/mutation/index.html" },
  thresholds: { high: 90, low: 80, break: 80 },
  tempDirName: ".stryker-tmp",
  // Per-test coverage analysis does not map mutants to tests under Vitest 5 (every mutant reported as untested),
  // so run the whole (fast) suite against each mutant instead.
  coverageAnalysis: "off",
};

export default config;
