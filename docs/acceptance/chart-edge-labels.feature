Feature: Chart date labels stay inside the chart (#184)
  With Last week picked, the growth chart's last tick is today at the right edge, and its label was clipped
  ("Oct 1" for Oct 19).

  Scenario: The last date on a weekly chart shows in full
    Given Progress at 1400 px wide with Last week picked
    Then every date under "Known … words — last week" lies inside the chart
    And the last label is the last day's date in full, as in the chart's table

  Scenario: Narrow screens too
    Given Progress at 390 px wide with Last week picked
    Then every date label lies inside the chart
