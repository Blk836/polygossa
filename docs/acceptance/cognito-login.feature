Feature: Login with Cognito (docs/production.md, phase 3)
  Sign-up, sign-in, password reset and email verification move to AWS Cognito's hosted pages. Production signs in
  only through its Cognito user pool; local runs (QA) through a separate QA user pool. The browser never sees a login
  token: the frontend's server keeps it in an httpOnly cookie, as before. The test-account auto-login stays only for
  the browser tests and stays impossible in production.

  # --- Signing up and in ---

  Scenario: Signing up opens Cognito's sign-up page
    Given Cognito is configured
    When a visitor chooses "Sign up" (landing page or /signup)
    Then they are sent to Cognito's hosted sign-up page
    And after confirming their email with the code Cognito sends, they land in the app, signed in

  Scenario: Signing in opens Cognito's sign-in page and returns to where they were going
    Given Cognito is configured and a visitor opens /review without a session
    When they sign in on Cognito's hosted page
    Then they land on /review, signed in

  Scenario: A first sign-in creates the account
    Given a person signs in through Cognito for the first time with a verified email
    Then an account is created for them, linked to their Cognito identity
    And its display name is the part of the email before the "@", its native language comes from their browser,
      tours are on and the plan is Free, as with sign-up before

  Scenario: An existing account with the same email is linked, not duplicated
    Given an account already exists for "ana@example.com" (made before Cognito)
    When "ana@example.com" signs in through Cognito with that email verified
    Then they get that account, with its data, and it is linked to their Cognito identity from now on

  Scenario: Signing in with Google reaches the same account as the password
    Given an account for "ana@gmail.com", made by signing up with a password
    When Ana chooses "Continue with Google" on Cognito's page and signs in with that Google account
    Then she gets the same account (Google's verified email links it), with all her data
    And the Google client's secret lives only in Secrets Manager, read at deploy, never in the code or template

  Scenario: An unverified email is never linked or used
    Given a Cognito identity whose email isn't verified
    When it tries to start a session
    Then it is refused, and no account is created or linked

  Scenario: Changing email in Cognito keeps the account
    Given an account linked to a Cognito identity
    When that identity signs in with a different email
    Then it still gets the same account (linked by identity, not email)

  Scenario: A suspended account can't sign in through Cognito
    Given a suspended account
    When its owner signs in through Cognito
    Then they are told the account is suspended, as before

  # --- Tokens ---

  Scenario: The backend accepts only its own pool's tokens
    Then a request with a Cognito access token from our pool and app client is signed in
    And a token from another pool, another app client, an ID token used as an access token, an expired token or a
      token with a bad signature gets 401

  Scenario: A session stays signed in past the access token's hour
    Given a signed-in learner whose access token has expired (or is about to)
    When they open a page or the page calls the API
    Then the frontend's server renews the token with the refresh token and the request succeeds
    And if renewing fails (refresh token revoked or expired), they are sent to sign in again

  Scenario: Sign-in is protected against forged returns
    When the sign-in return has a missing or wrong "state", or no code
    Then no session is created and the visitor is sent back to sign in
    And the address to return to is only ever a path on our own site

  # --- Signing out ---

  Scenario: Signing out ends the session at Cognito too
    When a learner signs out
    Then the session cookies are removed, the refresh token is revoked at Cognito
    And they pass through Cognito's sign-out, so the next sign-in asks for their password again

  Scenario: Signing out everywhere
    Given a learner signed in on a laptop and a phone
    When they choose "Sign out everywhere" in Settings › Profile
    Then the laptop lands on the landing page, signed out (passing through Cognito's sign-out)
    And the phone's next request is refused: every login token issued until then is refused by the backend
    And with Cognito, no device can renew its session (Cognito ends all of them)
    And signing in again afterwards works

  # --- Environments ---

  Scenario: Production signs in only through Cognito
    Given the production profile
    Then the old email-and-password sign-up and login endpoints and the test-account auto-login answer "not found"
    And the backend's own tokens are refused

  Scenario: Without Cognito settings nothing changes
    Given no Cognito settings (backend tests, browser tests)
    Then the email-and-password forms and the test-account auto-login work as before

  Scenario: The user pools are defined in CDK
    Then production's pool (in its stack) and the QA pool (its own stack) are in Ireland
    And people sign up with their email, which must be verified; passwords need 8+ characters with upper and lower
      case and a digit; accounts are recovered by email; MFA by authenticator app is optional
    And each has Cognito's hosted pages on its own Cognito address and one app client without a secret (PKCE),
      allowed to return only to its own site (production's address; localhost:3000 for QA)
    And production's pool is kept if its stack is deleted
