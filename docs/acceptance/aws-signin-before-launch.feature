Feature: IntelliJ checks the AWS sign-in before starting the local backend, and signs in if needed
  The local backend calls Amazon Translate as the developer, through the AWS profile "polygossa". When that sign-in
  had expired, the backend started anyway and every word lookup that needed Amazon failed with a long credentials
  error in the log. The app itself shouldn't refuse to start over an optional service, so the check lives in the
  developer's tooling: IntelliJ runs it before the Backend run configuration. When the sign-in is missing, it starts
  the AWS sign-in in the browser itself, and the backend starts once it succeeds.

  # --- Already signed in ---

  Scenario: Signed in to the app account
    Given the AWS profile "polygossa" has a valid sign-in to account 788826923437
    When I start Backend (or App) in IntelliJ
    Then the check prints which account it is signed in to, no browser opens, and the backend starts

  # --- Signing in ---

  Scenario: The sign-in has expired or was never made
    Given the AWS profile "polygossa" has no valid sign-in
    When I start Backend (or App) in IntelliJ
    Then the check says the sign-in is missing and opens the AWS sign-in in my browser ("aws login --profile polygossa")
    And it reminds me to pick "dream it ship it"
    When I finish signing in to "dream it ship it"
    Then the check confirms the account and the backend starts

  Scenario: I close the browser or cancel the sign-in
    Given the sign-in was opened in my browser
    When the sign-in fails, or I haven't finished it after 5 minutes
    Then the backend does not start, and the check says the sign-in didn't complete and how to retry

  Scenario: I pick the wrong account while signing in
    Given the sign-in was opened in my browser
    When I sign in to another account and the AWS CLI asks to overwrite the profile with that account
    Then the check answers "n" for me, so the profile is never switched to another account
    And the backend does not start, and the check names the account expected

  Scenario: Signed in to the wrong account already
    Given the AWS profile "polygossa" is signed in to another account
    Then the backend does not start, no browser opens, and the check names both the account found and the one expected

  # --- Other failures ---

  Scenario: The AWS CLI isn't installed where expected
    Given "C:\Program Files\Amazon\AWSCLIV2\aws.exe" doesn't exist
    Then the backend does not start, and the check says the AWS CLI is missing and where it looked

  Scenario: The AWS CLI hangs on the account check
    Given the AWS CLI hasn't answered the account check after 30 seconds
    Then the backend does not start, and the check says the sign-in check timed out

  # --- Where it runs ---

  Scenario: Only the local Backend run configuration checks
    Then the check runs only as a step before IntelliJ's Backend run configuration
    And nothing in the app, its tests, the local checks or production depends on it

  Scenario: The check is shared through the repository
    Then the check script and its IntelliJ run configuration ("Check AWS sign-in") are committed
    And the step before Backend is added to my own Backend run configuration, which git doesn't track
