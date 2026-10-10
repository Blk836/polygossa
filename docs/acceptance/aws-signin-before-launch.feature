Feature: IntelliJ checks the AWS sign-in before starting the local backend
  The local backend calls Amazon Translate as the developer, through the AWS profile "polygossa". When that sign-in
  had expired, the backend started anyway and every word lookup that needed Amazon failed with a long credentials
  error in the log. The app itself shouldn't refuse to start over an optional service, so the check lives in the
  developer's tooling: IntelliJ runs it before the Backend run configuration, and stops the launch if it fails.

  # --- The check ---

  Scenario: Signed in to the app account
    Given the AWS profile "polygossa" has a valid sign-in to account 788826923437
    When I start Backend (or App) in IntelliJ
    Then the check prints which account it is signed in to, and the backend starts

  Scenario: The sign-in has expired or was never made
    Given the AWS profile "polygossa" has no valid sign-in
    When I start Backend (or App) in IntelliJ
    Then the backend does not start
    And the check says the AWS sign-in is missing or expired
    And it shows the command to sign in again and says to pick "dream it ship it"

  Scenario: Signed in to the wrong account
    Given the AWS profile "polygossa" is signed in to another account
    Then the backend does not start, and the check names both the account found and the one expected

  Scenario: The AWS CLI isn't installed where expected
    Given "C:\Program Files\Amazon\AWSCLIV2\aws.exe" doesn't exist
    Then the backend does not start, and the check says the AWS CLI is missing and where it looked

  Scenario: The AWS CLI hangs
    Given the AWS CLI hasn't answered after 30 seconds
    Then the backend does not start, and the check says the sign-in check timed out

  # --- Where it runs ---

  Scenario: Only the local Backend run configuration checks
    Then the check runs only as a step before IntelliJ's Backend run configuration
    And nothing in the app, its tests, the local checks or production depends on it

  Scenario: The check is shared through the repository
    Then the check script and its IntelliJ run configuration ("Check AWS sign-in") are committed
    And the step before Backend is added to my own Backend run configuration, which git doesn't track
