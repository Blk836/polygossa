Feature: CI: every check runs on GitHub for every push (see docs/production.md, phase 6)
  Today the gauntlet's checks run only by hand on one Windows laptop. GitHub
  Actions runs them on Linux (like production) for every push, so a broken change shows up red on GitHub whoever
  pushed it and whatever machine they used. CI needs no AWS and no secrets. Mutation testing stays a local check (too
  slow per push), and deploying is a later step (phase 5).

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
    When a push changes only files under docs/
    Then CI does not run

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
    And the suite is split across 4 runners that run at the same time, each with its own servers, so it takes a
      few minutes rather than one runner's 7

  Scenario: Tools
    Then "node --test" runs the tools' tests and ESLint checks tools/ for complexity over 10 and files over 300 lines

  Scenario: The checks run side by side
    Then backend, frontend, end-to-end and tools are separate jobs that run at the same time
    And each job's name says which part it checks, so a red run shows where to look

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
      | a failing Vitest test                    | frontend   |
      | a TypeScript type error                  | frontend   |
      | an ESLint error (including file length)  | frontend   |
      | a frontend that doesn't build            | frontend   |
      | a failing Playwright test                | end-to-end |
      | a failing tools test or complexity error | tools      |

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
