Feature: The test gauntlet runs faster without losing coverage

  Background:
    Given the repository at its current state
    And a baseline timing of every suite taken before these changes

  # ---- 1. mutation testing only re-tests what changed ----

  # PIT 1.30 moved its incremental history into a paid plugin, so the backend narrows by git instead of reusing results.

  Scenario: Backend mutation testing covers only the classes a change touched
    Given one main class has changed since commit C (committed, uncommitted or newly added)
    When I run "./gradlew :backend:pitest -Ppitest.since=C"
    Then PIT mutates only that class (and its inner classes)
    And it runs only the tests that cover it

  Scenario: Nothing to mutate is a clear failure, not a silent pass
    Given no main class has changed since commit C
    When I run "./gradlew :backend:pitest -Ppitest.since=C"
    Then the build fails with "No backend main classes changed since C"

  Scenario: A full backend mutation run is still the default
    When I run "./gradlew :backend:pitest" with no properties
    Then PIT mutates every main class, as before

  Scenario: A second frontend mutation run reuses the results of the first
    Given "npm run mutate" has run once and written its incremental report
    And no covered module or test has changed since
    When I run "npm run mutate" again
    Then Stryker reuses every earlier result and runs no mutant again
    And it still prints the full mutation score and writes the HTML report

  Scenario: A frontend change re-tests the mutants it can affect
    Given "npm run mutate" has run once
    When one covered module changes
    Then the mutants in the changed code are run again
    And the score still covers every module in stryker.config.mjs

  Scenario: A changed test file re-tests the mutants it could have killed
    Given "npm run mutate" has run once
    When a test file changes
    Then mutants that file's tests had killed are run again
    And a reused result can only make the score lower than the truth, never higher

  Scenario: A full frontend mutation run can still be forced
    When I run "npm run mutate -- --force"
    Then Stryker ignores earlier results and runs every mutant

  Scenario: Thresholds still fail the build
    Given a reused or fresh mutation run
    When the frontend score falls below the "break" threshold
    Then "npm run mutate" fails, exactly as before

  # ---- 2. backend tests share booted apps ----

  Scenario: Tests with the same setup share one app
    Given test classes that need no settings, beans or fake servers of their own
    When the backend suite runs
    Then they all use the shared @ApiTest app instead of booting their own
    And every one of their tests still passes, unmodified in what it asserts

  Scenario: Tests that move time share one app with a movable clock
    Given test classes that only differ from @ApiTest by a movable clock
    When the backend suite runs
    Then they share one app whose clock each test resets before it starts
    And a test that moves the clock can't change the time another test sees

  Scenario: Tests that need a different app keep their own
    Given a test that changes settings (dev login off, branding, plan limits, AI on or off, seeded samples),
      alters the database schema, or talks to its own fake AI or YouTube server
    Then it still boots its own app, as before

  Scenario: Tests that read every public text keep their own app
    Given a test whose results depend on all public texts in the database (the recommendation shelves)
    Then it keeps its own app and database, so other classes' texts can't change what it sees

  Scenario: Fewer apps are booted
    When the backend suite runs in a single JVM
    Then fewer separate apps are booted than before (counted from the test log)
    And the number of tests run is the same as before, all passing

  # ---- 3. tests run in parallel ----

  Scenario: Backend test classes run in several processes at once
    When I run "./gradlew :backend:test"
    Then test classes are split across several JVMs (at most 4, for memory)
    And each JVM uses a JIT and GC that don't compete for cores
    And the same number of tests run, all passing
    And the run is not flaky: three full runs in a row all pass

  Scenario: Playwright uses more workers
    When I run "npm run e2e"
    Then specs run on the worker count that measured fastest without failures
    And three full runs in a row all pass

  # ---- results ----

  Scenario: The speed-up is measured, not assumed
    When the changes are in
    Then each suite is timed again on the same machine with nothing else running
    And the report shows before and after wall-clock times for each suite
