Feature: The owner's email lives outside the repository
  The repository is going public (#212), so no personal email may be in its files. Production still emails its alarms
  to the owner and makes the owner the site's admin; that address now comes at deploy time from the CDK setting
  owner-email, kept in ~/.cdk.json on the deploying PC (or passed as -c owner-email=… from a GitHub secret).

  Scenario: A deploy with the owner's email sets alerts and admins from it
    Given ~/.cdk.json has the context owner-email "owner@example.com"
    When production is synthesized
    Then its alarms email owner@example.com
    And its backend's FORUM_ADMINS is exactly owner@example.com

  Scenario: Synthesizing without it still works, with no admins and no alert emails
    Given no owner-email is set (as in the checks on GitHub)
    When production is synthesized
    Then it succeeds, the backend's FORUM_ADMINS is empty and no alert email is subscribed

  Scenario: The local deploy refuses to go without it
    Given no owner-email in ~/.cdk.json
    When I run node tools/local-deploy.mjs
    Then it stops before deploying and says to add "owner-email" to the context in ~/.cdk.json

  Scenario: A GitHub deploy takes it from a secret
    When the deploy job runs on GitHub
    Then cdk deploy is given -c owner-email from the OWNER_EMAIL secret

  Scenario: No personal email in the repository
    When the tools tests run
    Then every email address in a tracked file is at example.com, a test domain (test.co, b.co, x.co, lector.local)
      or GitHub's users.noreply.github.com, and any other address fails the test with its file and line
