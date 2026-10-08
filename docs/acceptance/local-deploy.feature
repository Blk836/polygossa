Feature: Local deploy: production is deployed from the developer's PC, not from GitHub (cheap mode)
  GitHub Actions minutes are nearly used up. The checks already run on our PC (local-checks.feature); now the deploy
  does too. The flow is: run the local checks on the branch, merge it to main when they are green, then deploy main to
  production from the PC. GitHub runs nothing by default; its deploy job stays available as a button.

  # --- Deploying ---

  Scenario: One command deploys what is on main
    Given a pull request has just been merged to main
    When a session runs "node tools/local-deploy.mjs"
    Then the latest main on GitHub is deployed (not the session's branch, and not unpushed work)
    And it is deployed from the PC's own deploy copy of the repository, so no session's worktree or branch changes
    And production and the QA user pool are updated, as GitHub's deploy did ("cdk deploy PolygossaStaging PolygossaQa")

  Scenario: The site is checked after the deploy
    When the deploy finishes
    Then it checks the production sign-in page answers
    And that the backend answers through the site (the public languages list)
    And it waits a few minutes for them, since new containers take a while to start
    And if either never answers, the deploy is reported as failed

  Scenario: The result is recorded on GitHub
    When a deploy starts, passes or fails
    Then main's commit gets a "deploy production" mark on GitHub: pending while it runs, then green or red
    And the summary says which commit was deployed, the site's address and how long it took

  Scenario: Main that is already deployed is not deployed again
    Given main's latest commit already has a green "deploy production" mark
    When a session runs the deploy
    Then nothing is deployed and it says main is already live
    And "--again" deploys it anyway (say, to retry after AWS had a problem)

  Scenario: Two sessions merging close together deploy once
    Given two sessions merged one after the other and both start the deploy
    Then they take turns (the same PC lock as the local checks; a deploy builds Docker images, a heavy run)
    And the second, once it has the turn, deploys only if main has moved past what the first deployed

  # --- What a deploy needs, checked before anything runs ---

  Scenario: Expired AWS sign-in
    Given the "polygossa" AWS profile's sign-in has expired (it lasts 12 hours) or was never made
    When the deploy is started
    Then it stops before deploying and says to run "aws login --profile polygossa"
    And nothing is marked on GitHub

  Scenario: Signed in to the wrong AWS account
    Given the profile's account is not the app's account (the AWS_ACCOUNT_ID repository variable)
    When the deploy is started
    Then it refuses, naming both accounts

  Scenario: Docker isn't running
    Given Docker Desktop is not running
    When the deploy is started
    Then it stops before deploying and says to start Docker Desktop (the deploy builds the app's images)

  Scenario: A failed deploy says so
    When "cdk deploy" fails
    Then the site checks don't run, main's mark is red, and the command exits with an error
    And CloudFormation rolls production back by itself, as before

  # --- What GitHub still does ---

  Scenario: Merging to main runs nothing on GitHub by default
    When a pull request is merged to main
    Then GitHub does not deploy and uses no minutes

  Scenario: GitHub can still deploy when asked
    When the CI workflow is started by hand on main with "deploy_only" ticked
    Then GitHub deploys production as before (staging.feature), signed in through its deploy role
    And setting the repository variable DEPLOY_ON_GITHUB to "true" makes every merge to main deploy from GitHub again

  # --- How these are verified ---
  # The order of steps, the refusals, skipping a deployed main, the marks and the site checks are unit-tested with
  # node --test (tools/), against fakes of git, AWS, Docker and GitHub. The real thing is checked by using it: this
  # change's own merge is deployed with the tool, and the run's summary goes in the final report.
