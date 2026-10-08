Feature: Monitoring production (docs/production.md, phase 6)
  When production breaks or costs too much, the owner gets an email, without having to look. Everything is AWS-only
  (CloudWatch alarms, an AWS budget), defined in CDK, in Ireland. Sentry waits for the owner's Sentry account.

  Background:
    Given the owner confirmed the one subscription email AWS sends to the alert address

  Scenario: The site going down is emailed
    When the load balancer finds no healthy frontend for 2 minutes in a row
    Then the owner gets an email that the site is down, and another when it is back

  Scenario: The backend stopping is emailed
    When no backend task reports in for 5 minutes (it crashed, or failed to start after a deploy)
    Then the owner gets an email that the backend is down

  Scenario: A rise in server errors is emailed
    When the site answers 10 or more server errors (5xx) within 5 minutes
    Then the owner gets an email about the errors

  Scenario: A database under strain is emailed
    When the database's CPU stays above 80% for 15 minutes, or its free storage falls below 2 GB
    Then the owner gets an email about it

  Scenario: The monthly AWS bill is watched
    Given a monthly budget of $100 for the app's account
    When the month's actual cost passes 80% of it, or the forecast for the month passes 100%
    Then the owner gets an email from AWS Budgets

  Scenario: Quiet when all is well
    Given nothing is wrong
    Then no email is sent; an alarm with no data (e.g. no traffic at night) is not a failure, except for the
      "backend is down" alarm, where silence is the failure

  Scenario: Alarms are defined in CDK and tested
    Then each alarm, the alert topic, its email subscription and the budget are in production's stack
    And synthesizing the stack without AWS access checks each one's metric, threshold and recipient
