Feature: Local checks: the full suites run on the developer's PC, not on GitHub (cheap mode)
  GitHub Actions minutes cost about $10 on a busy day (2,000 free minutes a month went in two days), so by default
  the gauntlet's suites run on our own PC (and so does the deploy: local-deploy.feature). Several Claude sessions work in parallel, but the PC
  can run one heavy suite at a time (memory, and the end-to-end suite's fixed ports), so runs take turns through one
  lock. The result is recorded on the pull request as a "local checks" mark. Running the checks on GitHub (ci.feature)
  still works, but only when asked.

  # --- Running the checks locally ---

  Scenario: One command runs the checks a branch needs
    Given a session's branch with its work committed
    When it runs "node tools/local-checks.mjs"
    Then the checks are picked from what the branch changes compared with main, by the same rules CI uses
      (ci.feature: "A pull request runs only the checks for the parts it changed")
    And each picked suite runs with the gauntlet's commands: backend (compile, checkstyle, tests), frontend (unit
      tests, type check, lint, build), end-to-end, infra (type check, tests, synth) and tools (tests, lint)
    And every picked suite runs even when an earlier one failed, so one run shows every problem
    And it ends with a summary: each suite passed or failed, and how long it took

  Scenario: Everything can be forced
    When it runs "node tools/local-checks.mjs --all"
    Then every suite runs, whatever the branch changed

  Scenario: A docs-only branch needs no suites
    Given a branch that changes only docs/ or Markdown files
    When the local checks run
    Then no suite runs and the result is green ("nothing to check")

  Scenario: Uncommitted changes are refused
    Given the working copy has uncommitted or untracked changes
    When the local checks are started
    Then they refuse to start and say why, since the result would not describe any commit

  Scenario: The commit must not change during the run
    Given the local checks are running
    When the branch's commit changes before they finish (a new commit, a checkout)
    Then the result is not recorded on the pull request, and the summary says the run is out of date

  # --- Taking turns: one heavy run on the PC at a time ---

  Scenario: Only one run at a time across all sessions
    Given one session's local checks are running
    When another session (in any worktree of this repository) starts its local checks
    Then the second waits, and says who it is waiting for: that run's branch, folder and start time
    And it starts by itself as soon as the first finishes, without anyone having to message anyone

  Scenario: Waiting runs go in turn
    Given one run is going and two more are waiting
    When the first finishes
    Then exactly one of the waiting runs starts; the other keeps waiting

  Scenario: The turn is given back however a run ends
    When a run passes, fails, or is stopped with Ctrl+C
    Then the lock is released and the next waiting run can start

  Scenario: A run that died doesn't block everyone
    Given the lock is held by a process that no longer exists (a crashed or killed session)
    When another run starts
    Then it takes the lock over, saying it did and whose it was

  Scenario: A single heavy command can take its turn too
    When a session runs one heavy command on its own (say just the backend tests, one end-to-end spec, or mutation
      testing) with "node tools/local-checks.mjs --run -- <command>"
    Then that command waits for and holds the same lock while it runs
    And its exit code is the command's

  # --- The result on GitHub ---

  Scenario: A green run marks the pull request
    Given the branch's commit is on GitHub
    When the local checks pass
    Then that commit gets a green "local checks" mark on GitHub, saying which suites ran
    And it shows on the pull request next to any other checks (and in "gh pr checks")

  Scenario: A red run marks the pull request red
    When any picked suite fails
    Then the commit gets a red "local checks" mark naming the suites that failed

  Scenario: The commit isn't on GitHub yet
    Given the branch's latest commit hasn't been pushed
    When the local checks finish
    Then the summary says the mark could not be recorded and to push and run again (or push first next time)

  Scenario: A new commit needs a new run
    Given a commit with a green "local checks" mark
    When another commit is pushed to the branch
    Then the new commit has no mark until the local checks run on it

  # --- Merging ---

  Scenario: A pull request is merged only with a green local mark on its latest commit
    Given a pull request ready to merge
    Then it is merged only when its latest commit has a green "local checks" mark
    And that commit already contains the latest main; if main has moved, main is merged into the branch and the
      local checks run again first (the checks run on the branch as it is, not on a merge GitHub makes)

  # --- What GitHub still runs ---

  Scenario: GitHub runs no checks by default
    When a pull request is opened or updated
    Then no check job runs on GitHub and no CI minutes are used for it

  # Changed October 2026 (cheap mode): merges are no longer deployed by default, to save AWS and build costs.
  Scenario: Merging to main is not deployed unless asked
    When a pull request is merged to main
    Then nothing is deployed and GitHub runs nothing; the change is tried on the local app
    And production keeps running the last deployed main until the user asks for a deploy

  Scenario: Deploying when the user asks
    When the user asks for a deploy
    Then the session deploys the latest main from the PC (local-deploy.feature)
    And the checks are not run again

  Scenario: GitHub can still run the checks when asked
    When a pull request is given the label "ci" (or the workflow is started by hand on a branch)
    Then the checks run on GitHub exactly as ci.feature describes, and that run's result shows on the pull request
    And removing the label stops it running on later pushes

  Scenario: One setting turns GitHub checks back on for every pull request
    When the repository variable CHECKS_ON_GITHUB is set to "true"
    Then every pull request is checked on GitHub again, as ci.feature describes, with no workflow change
    And setting it back (or deleting it) returns to local checks

  # --- How these are verified ---
  # The lock, the picking, the refusal and recording rules are unit-tested with node --test (tools/), including two
  # runs racing for the lock and a lock left by a dead process. The workflow is checked by running it: a pull request
  # without the label runs no check jobs; adding the label runs them; a merge still deploys. The run links go in the
  # final report.
