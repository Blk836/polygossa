Feature: Real Cognito sign-in is exercised by a browser test against the QA user pool (#84)
  The browser tests sign in automatically as the test account, so the Cognito flow was covered only by unit tests,
  backend tests against a fake pool and a hand check. The QA pool sends sign-ins back to http://localhost:3000, the
  local app, so this test drives that app and runs by hand (npm run e2e:live), never in the ordinary suites.

  Background:
    Given the local app is running on http://localhost:3000, signing in through the QA user pool
    And AWS is signed in with the polygossa profile

  Scenario: A learner signs in through the QA pool's sign-in page
    Given a new QA user live-check-<time>@example.com with a confirmed email and a password, made with Cognito's admin API
    When they click Sign in on /login and sign in on the QA pool's page with that email and password
    Then they are back in the app, signed in, and /api/me answers with their email

  Scenario: Deleting the account removes the user from the pool
    Given that learner is signed in
    When they delete their account, confirming their email
    Then Cognito no longer has that user

  Scenario: Nothing is left behind if the test fails part-way
    When the test ends, passing or failing
    Then the QA user it made is deleted from the pool

  Scenario: Missing prerequisites are named
    Given the local app isn't running, or AWS isn't signed in
    When I run npm run e2e:live
    Then it fails saying which one is missing

  Scenario: The ordinary suites never run it
    When the end-to-end suite runs (npm run e2e, the local checks)
    Then the live sign-in test isn't among its tests
