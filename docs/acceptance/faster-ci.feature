Feature: GitHub's checks finish faster by running in more parallel jobs

  A pull request's checks took about 12 minutes: one backend job (about 7 minutes) and two end-to-end
  shards (7 to 12 minutes each, 2 of them starting the servers). The repository is public, so GitHub's
  minutes are free and more jobs at once cost nothing.

  Scenario: The backend tests are split across three jobs
    When a pull request needs the backend checks
    Then three backend jobs run at once, "backend (1/3)", "backend (2/3)" and "backend (3/3)"
    And each runs the compile, Checkstyle and its own share of the test classes
    And every test class runs in exactly one of them, so together they run the same tests as before

  Scenario: A test class always lands in the same backend shard
    Given a test class's name
    Then its shard depends only on that name, so a re-run of one failed shard runs the same classes again
    And a class's nested test classes run in the same shard as it

  Scenario: Running the backend tests without a shard runs them all
    When the backend tests run with no shard set, as on the developer's PC and in local-checks.mjs
    Then every test class runs, as before

  Scenario: A wrong shard setting stops the run
    When the shard is set to something other than "<number>/<count>" with 1 <= number <= count
    Then the backend tests fail to start with a message naming the setting, rather than running nothing

  Scenario: The end-to-end tests are split across six jobs
    When a pull request needs the end-to-end checks
    Then six end-to-end jobs run at once, "end-to-end (1/6)" to "end-to-end (6/6)", each with its own servers
    And together they run every Playwright test once

  Scenario: A failed shard keeps its own report
    When one backend or end-to-end shard fails
    Then its test report is uploaded under a name with its shard number, without overwriting another shard's
    And the other shards still run to the end

  Scenario: Re-running a failure re-runs only the failed shards
    When "gh run rerun <id> --failed" is used
    Then only the failed shards run again

  Scenario: The checks are quicker
    Then a pull request needing every check finishes in clearly less time than the 12 minutes before
