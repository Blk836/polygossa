Feature: Today in the Progress period dropdown

  Scenario: Today is offered first, and last week stays the default
    Given I open Progress
    Then the Period dropdown offers "Today", "Last week", "Last month", "Last quarter", "Last year", "All time"
    And "Last week" is selected

  Scenario: Choosing Today shows only today's activity
    Given I read for 5 minutes, read 300 words, listened 2 minutes and learned 4 words today
    And I did other activity yesterday
    When I choose "Today"
    Then a "Today" card shows Words learned 4, Minutes read 5, Words read 300, Listening 2 min
    And there is no "Days practised" tile

  Scenario: Today is compared with yesterday
    Given I read 10 minutes yesterday and 15 minutes so far today
    When I choose "Today"
    Then Minutes read says "+50% on yesterday"
    And a figure lower than yesterday's shows yesterday's figure, e.g. "12 min yesterday"
    And a figure where yesterday was zero says "Up from nothing yesterday"

  Scenario: Nothing done yet today
    Given I have done nothing today or yesterday
    When I choose "Today"
    Then every tile shows 0 with "Nothing yet — start today"

  Scenario: "Today" follows my time zone
    Given my time zone is ahead of UTC, and it is just after midnight for me
    When I choose "Today"
    Then activity from before my midnight counts as yesterday, not today

  Scenario: The growth chart stays useful
    When I choose "Today"
    Then the chart shows the last week's known-words curve, titled "Known <language> words — last week"

  Scenario: Streak, goal and the all-time line don't change
    When I choose "Today"
    Then the streak, today's goal and the "All time" line at the bottom are unchanged

  Scenario: A failed request keeps the last stats
    Given the request for today's stats fails
    When I choose "Today"
    Then an error says so, and the page still shows the streak and the previous stats

  Scenario: The API accepts and rejects periods
    When the app asks for the dashboard with period "today"
    Then it gets today's totals and yesterday's for comparison, over 1 day
    And an unknown period is still refused with the list of valid ones, now including "today"
