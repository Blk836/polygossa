Feature: Review's goal run isn't shown as a second day streak (#179)
  The top bar and Progress show the day streak. Review's goal bar showed a different number, days in a row with the
  review goal met, under the same flame and "Day streak" title, so the app seemed to disagree with itself.

  Scenario: The goal bar names its run for what it is
    Given a Pro account that met its review goal on none of the last days but read today
    When Practice › Review is open
    Then the goal bar says "0 days in a row at goal"
    And it shows no flame and nothing titled "Day streak"

  Scenario: One day reads in the singular
    Given the review goal was met today only
    Then the goal bar says "1 day in a row at goal"

  Scenario: The day streak still shows in the top bar
    Given the same account
    Then the top bar's flame still shows the day streak, unchanged
