Feature: CI: every check runs on GitHub for every push (see docs/production.md, phase 6)
  Today the gauntlet's checks run only by hand on one Windows laptop. GitHub
  Actions runs them on Linux (like production) for every push, so a broken change shows up red on GitHub whoever
  pushed it and whatever machine they used. CI needs no AWS and no secrets. Mutation testing stays a local check (too
  slow per push), and deploying is a later step (phase 5).

  Paused (October 2026): GitHub's minutes cost too much, so by default the checks run on the developer's PC
  (local-checks.feature) and the scenarios below apply only when CI is asked to run them: a pull request labelled
  "ci", a hand-started run, or every pull request while the repository variable CHECKS_ON_GITHUB is "true".
  "CI is where the full suites run" is replaced by local-checks.feature until then.

  Background:
    Given the repository on GitHub with the CI workflow in .github/workflows/

  # --- When it runs ---

  Scenario: Every pull request is checked, once
    When a pull request is opened or updated
    Then the CI workflow runs on Linux against the pull request merged with main
    And GitHub shows its result (green or red) on the pull request
    And merging it to main doesn't run the checks again (it deploys; see staging.feature), so the same code isn't
      paid for twice
    And a push to a feature branch without a pull request isn't checked

  Scenario: A pull request is re-checked when main moved
    Given main changed after a pull request's checks ran
    When we are about to merge it
    Then the branch is updated from main first, and merged only once the new checks are green

  Scenario: A newer push replaces an older run on the same branch
    Given a CI run is still going on a branch other than main
    When another commit is pushed to that branch
    Then the older run is cancelled and only the newest commit is checked

  Scenario: Docs-only changes don't use CI minutes
    When a push changes only files under docs/ or Markdown files anywhere (CLAUDE.md, READMEs)
    Then CI does not run

  Scenario: CI is where the full suites run
    Then the full suites run only on CI, not on the developer's machine before a pull request
    And locally only the tests being written or changed run, plus mutation testing, which CI doesn't run

  Scenario: It can be run by hand
    When I start the workflow from the Actions tab
    Then it runs against the chosen branch like a push would

  # --- What it checks: the same commands as the gauntlet, so local and CI agree ---

  Scenario: Backend
    Then "./gradlew :backend:compileJava", ":backend:checkstyleMain" and ":backend:test" run on JDK 21
    And the tests get PostgreSQL through Testcontainers on the runner's Docker, as locally

  Scenario: Frontend
    Then "npm ci", "npm test", "npx tsc --noEmit", "npx eslint ." and "npx next build" run in frontend/

  Scenario: End-to-end
    Then "npm run e2e" runs the Playwright suite in Chromium against a production build, with its own backend and
      PostgreSQL, as locally
    And no OpenAI key is set, so no test calls OpenAI
    And the suite is split across 2 runners that run at the same time, each with its own servers, so it takes
      about 6-7 minutes rather than one runner's 10
    And it is not split further: each runner builds the backend and frontend itself, so 4 runners cost about 20
      billed minutes for the tests that 2 runners check for about 13

  Scenario: Tools
    Then "node --test" runs the tools' tests and ESLint checks tools/ for complexity over 10 and files over 300 lines

  Scenario: The checks run side by side
    Then backend, end-to-end, and one "quick checks" job (frontend, infra and tools) run at the same time
    And the quick checks share one job because GitHub bills every job as at least a whole minute, and each of them
      takes well under one
    And each job's name, and each step's name inside the quick-checks job, says which part it checks, so a red run
      shows where to look

  # --- Only the checks a change can affect (saves CI minutes) ---

  Scenario Outline: A pull request runs only the checks for the parts it changed
    Given a pull request that changes only <files>
    When CI runs
    Then <checks> run
    And every other check is skipped (shown as skipped, not red) and costs no minutes

    Examples:
      | files                                               | checks                                        |
      | backend/ or the Gradle build (build files, gradle/) | backend and end-to-end                        |
      | frontend/                                           | frontend, tools and end-to-end                |
      | infra/                                              | infra                                         |
      | tools/                                              | tools                                         |
      | backend/ and infra/                                 | backend, end-to-end and infra                 |

  Scenario: The tools checks follow the frontend's packages
    Given the tools checks use ESLint from frontend/'s packages
    When a pull request changes only files under frontend/
    Then the tools checks run too

  Scenario: Changing CI itself runs everything
    When a pull request changes the CI workflow (.github/) or the script that decides which checks run
    Then every check runs, so a broken workflow can't skip the checks that would show it

  Scenario: A change outside the known parts runs everything
    When a pull request changes a file outside backend/, frontend/, infra/, tools/ and the Gradle build
      (for example the compose files, scripts/ or .env.example)
    Then every check runs: when unsure, check rather than skip

  Scenario: The choice depends on the pull request's own changes
    Given main has moved since the branch was made
    When the pull request's checks run
    Then which checks run depends only on what the pull request changes compared with main, not on what else
      landed on main (those changes were checked on their own pull requests)

  Scenario: Started by hand, everything runs
    When I start the workflow from the Actions tab (not deploy-only)
    Then every check runs

  Scenario: If the changed files can't be read, everything runs
    Given the list of the pull request's changed files can't be worked out
    When CI runs
    Then every check runs, rather than none

  # --- Failures ---

  Scenario Outline: Any failing check makes the run red
    Given a commit with <problem>
    When CI runs
    Then the <job> job fails and the run is red

    Examples:
      | problem                                  | job        |
      | a failing backend test                   | backend    |
      | a Java method over complexity 10         | backend    |
      | a Java compile error                     | backend    |
      | a failing Vitest test                    | quick checks (frontend step) |
      | a TypeScript type error                  | quick checks (frontend step) |
      | an ESLint error (including file length)  | quick checks (frontend step) |
      | a frontend that doesn't build            | quick checks (frontend step) |
      | a failing Playwright test                | end-to-end |
      | a failing infra test or synth error      | quick checks (infra step) |
      | a failing tools test or complexity error | quick checks (tools step) |

  Scenario: Failed runs keep what's needed to see why
    When the backend or end-to-end job fails
    Then the test reports (Gradle's for the backend; Playwright's, with traces, for end-to-end) are attached to the
      run for 14 days

  Scenario: CI has no secrets and no cloud access
    Then the workflow uses no repository secrets and no AWS credentials
    And its GitHub token can only read the repository

  # --- How these are verified ---
  # A workflow is checked by running it. Before it counts as done: a run on a branch is green with every job, and a
  # throwaway branch with a deliberate failure in each job (a failing assertion, an over-complex method) turns that
  # job red; that branch is deleted afterwards. The run links go in the final report.
