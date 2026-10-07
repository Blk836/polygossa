// Mutation testing (npm run mutate). Covers the modules with unit tests: the reader's text, transcript, paging
// (and fitting pages to the screen), settings and audio logic, word colour classes, vocabulary/review query helpers and the API client,
// library media helpers, the video playback clock and YouTube play states, categories, theme, card layout and card status (difficulty, reading progress), playlists, the header nav and its streak/known-words figures, library filters, the landing page (sign-up links, demo reader, showreel timeline), the sign-in splash timeline, brand name, progress (streak, milestones, calendar), skill levels, Explore recommendations, the forum, profile photos (file checks, crop maths), word imports, writing tests, languages and native-language translations, the admin panel, first-visit tours and the listening clock. React components are covered by the
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
    "lib/skill-levels.ts",
    "lib/recommendations.ts",
    "lib/forum.ts",
    "lib/photo.ts",
    "lib/word-import.ts",
    "lib/playlists.ts",
    "lib/nav.ts",
    "lib/header-stats.ts",
    "lib/library-filters.ts",
    "lib/landing.ts",
    "lib/showreel.ts",
    "lib/splash.ts",
    "lib/languages.ts",
    "lib/dictionary.ts",
    "lib/admin.ts",
    "lib/tours.ts",
    "components/reader/listen-clock.ts",
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
  // Reuse the last run's results (reports/stryker-incremental.json) for mutants whose code and tests haven't changed,
  // so a run costs about what the change touched; the score and report still cover every module.
  // `npm run mutate -- --force` re-runs every mutant. Without per-test coverage, a reused result can be stale after a
  // test file broke and was fixed (its mutants stay "no coverage"), which only ever lowers the score: if a score looks
  // too low, force a run.
  incremental: true,
  // Per-test coverage analysis does not map mutants to tests under Vitest 5 (every mutant reported as untested),
  // so run the whole (fast) suite against each mutant instead.
  coverageAnalysis: "off",
};

export default config;
