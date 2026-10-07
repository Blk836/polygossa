Feature: Words read, time listened and a daily goal of my choice (see docs/architecture/progress-and-levels.md)
  LingQ's headline stats are "words read" and "hours listened", and many learners set one as their daily goal. Here
  the only daily goal was reviews, and the streak only needed a minute of reading. Now the app counts words read and
  time listened, shows them on Progress, and lets each learner pick what their daily goal measures. A stricter
  streak (only days that reach the goal) is an opt-in setting, so nobody's streak changes overnight.

  Background:
    Given I am signed in

  # --- Words read ---

  Scenario: Turning a page counts its words as read
    Given a text whose first page holds 120 words
    When I turn from the first page to the second (progress goes from token 0 to the second page's first token)
    Then today's words read go up by 120

  Scenario: Going back and re-reading
    When I go back a page, nothing is added
    And reading forward again over the same page counts it again (re-reading is reading)

  Scenario: Skipping ahead is capped
    When progress jumps forward by more than 500 words in one step (e.g. picking the last page)
    Then at most 500 words are counted for that step

  Scenario: Finishing a lesson counts the last page
    Given I am on the last page of a text
    When I click "Finish lesson"
    Then the words from my position to the end are counted (at most 500)

  Scenario: Words read are per day in my time zone and per language
    When I read in Spanish at 23:30 and in French at 00:10 the next day (my time zone)
    Then each day gets its own words, and each language its own

  # --- Time listened ---

  Scenario: Playing audio or video counts as listening
    Given audio plays for 40 seconds between two heartbeats
    When the heartbeat reports listenedSeconds 40
    Then the session's listening time goes up by 40

  Scenario: Listening credit is capped like reading time
    When a heartbeat claims more listening than the time since the previous heartbeat (or more than 5 minutes)
    Then only the elapsed time (at most 5 minutes) is credited, and negative values credit nothing

  Scenario: Listening while not touching the page
    Given the reader is idle (no input for two minutes) but the audio keeps playing
    Then listening time keeps counting while reading time stops

  Scenario: Older clients
    When a heartbeat has no listenedSeconds
    Then reading time is credited as before and listening time is unchanged

  # --- Progress ---

  Scenario: Progress shows words read and time listened
    When I open Progress
    Then the period card shows "Words read" and "Listening" (hours and minutes) beside words learned and minutes read,
      each against the period before
    And the all-time line includes words read and time listened
    And each activity day carries its words read and seconds listened

  Scenario: Listening and reading count as practice for the streak
    Then a day with a minute of listening, or any words read, counts as practised

  # --- The daily goal ---

  Scenario: Reviews by default
    When I request GET /api/me
    Then dailyGoal is {kind: "reviews", target: <my daily review goal>}

  Scenario Outline: Choosing what my daily goal measures
    When I set my daily goal to <kind> with target <target> in Settings › Profile
    Then GET /api/me returns that goal

    Examples:
      | kind             | target |
      | words_read       | 1000   |
      | minutes_read     | 20     |
      | minutes_listened | 30     |
      | reviews          | 40     |

  Scenario: A reviews goal is the review goal
    When I set my daily goal to reviews with target 40
    Then my daily review goal (used by Review) is 40 too

  Scenario Outline: Invalid goals are refused
    When I set my daily goal to <kind> with target <target>
    Then I get 400 and my goal is unchanged

    Examples:
      | kind             | target |
      | words_read       | 10     |
      | words_read       | 50001  |
      | minutes_listened | 0      |
      | minutes_read     | 601    |
      | pages            | 10     |

  Scenario: Today's goal on Progress and in the header
    Given my goal is 1,000 words read and I have read 340 words today
    When I open Progress
    Then a "Today's goal" card shows "340 / 1,000 words read" with a progress bar at 34%
    And GET /api/dashboard/header carries the goal with done 340 and met false
    And at 1,000 or more it says the goal is reached

  Scenario: Opt-in strict streak
    Given I turned on "Only count days I reach my daily goal" in Settings
    Then a day only counts toward my streak when the goal was reached
    And with the setting off (the default), any practice counts, as before
