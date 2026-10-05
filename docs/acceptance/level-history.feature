Feature: Level history and smoothing (docs/ai-plan.md, section 2)
  Shown levels move only once the evidence has held for a while, so a level doesn't flicker when a learner hovers
  around a threshold or has one good or bad writing test. Each day's shown levels are recorded, and Progress shows
  when each level changed.

  Terms:
    raw level   = the level computed from today's evidence (the rules in skill-levels.feature)
    shown level = the level on the Progress card, which moves only when a change is confirmed
    pending     = a raw level that differs from the shown one and is waiting to be confirmed

  Background:
    Given I am signed in and my target language is Spanish

  # --- Smoothing ---

  Scenario: The first level appears straight away
    Given I have never had a Reading level
    When I reach 50 known words and open Progress
    Then Reading shows A1 immediately, with no waiting period

  Scenario: A move up waits 7 days
    Given Reading shows A1
    And my raw Reading level becomes A2 on 1 October
    When I open Progress on 1 October
    Then Reading shows A1, with "On track for A2 · confirms on 8 October"
    When I open Progress on 8 October and the raw level is still A2
    Then Reading shows A2 and nothing is pending

  Scenario: A move down waits 7 days too
    Given Writing shows B1
    And my raw Writing level drops to A2 on 1 October
    Then Writing shows B1 with "Trending to A2 · confirms on 8 October" until then
    And it shows A2 from 8 October if the raw level is still A2

  Scenario: Falling back before the 7 days cancels the change
    Given Reading shows A1 and A2 has been pending since 1 October
    When my raw level is back to A1 on 5 October
    Then Reading shows A1 and nothing is pending
    And if the raw level reaches A2 again on 6 October, the 7 days start again from 6 October

  Scenario: Changing direction restarts the wait
    Given Writing shows B1 and B2 has been pending since 1 October
    When the raw level is A2 on 4 October
    Then A2 is pending since 4 October, and B2 is forgotten

  Scenario: Jumping more than one level in the same direction keeps the original start
    Given Reading shows A1 and A2 has been pending since 1 October
    When the raw level is B1 on 3 October
    Then B1 is pending, still since 1 October
    And on 8 October Reading shows B1

  Scenario: A confirmed writing change can come sooner with a second test
    Given Writing shows A2 and B1 has been pending since 1 October after a graded test
    When I get another graded test on 3 October and the raw Writing level is still B1
    Then Writing shows B1 on 3 October, without waiting the full 7 days

  Scenario: Losing a level is shown straight away
    Given Listening shows A2
    When my raw Listening level becomes "Not enough data" (e.g. the finished videos were deleted)
    Then Listening shows "Not enough data" immediately and nothing is pending

  Scenario: Confidence and evidence are always today's
    Given Reading shows A1 with A2 pending
    Then the confidence and the "known words · finished texts" line are today's figures, not frozen ones

  Scenario: Overall follows the shown levels, not the raw ones
    Given Reading shows B1 with B2 pending, Listening shows B1, Writing shows A2
    Then Overall is A2: the average of the shown B1, B1 and A2, rounded down (B2 pending doesn't count)

  Scenario: Each language is smoothed separately
    Given Spanish Reading has A2 pending
    When I switch to French
    Then French has its own shown levels and its own pending changes

  # --- When levels are recalculated ---

  Scenario: Opening Progress recalculates and records today
    When I open Progress
    Then today's shown levels are saved as today's snapshot for that language (one per day; later visits update it)

  Scenario: A graded writing test recalculates straight away
    When a writing test is graded
    Then that language's levels are recalculated and today's snapshot updated, without opening Progress

  Scenario: Learners who practised but didn't open Progress are still recorded
    Given I read Spanish today but didn't open Progress
    When the nightly update runs (after midnight UTC)
    Then my Spanish levels are recalculated and a snapshot saved for the day I practised
    And learners with no activity that day get no snapshot

  Scenario: Pending changes are timed by calendar days in my timezone
    Given my timezone is Asia/Tokyo
    Then "7 days" means 7 calendar days in Tokyo, the same way the daily AI allowance and the streak count days

  # --- History on Progress ---

  Scenario: The history lists each change
    Given my snapshots show Reading A1 from 1 Sep, A2 from 20 Sep, B1 from 3 Oct
    When I open Progress
    Then the Skill levels card has a "Level history" list for Reading: "A1 since 1 Sep → A2 on 20 Sep → B1 on 3 Oct"
    And the same for Listening and Writing, each only from when it first had a level

  Scenario: History before this feature
    Given I used the app before snapshots existed
    Then my history starts on the first day levels were recorded, and says "History starts 5 Oct 2026"

  Scenario: No history yet
    Given I have no snapshots in this language
    Then the history section says "Your level changes will appear here"

  Scenario: History via the API
    When I GET /api/levels/history?language=es
    Then I get each skill's changes, oldest first, as {level, since}
    And another user's history is never included
    And a language with no snapshots returns empty lists

  Scenario: Deleting a text doesn't rewrite history
    Given my history shows Listening A2 from 20 Sep
    When I delete the videos that earned it
    Then the history still shows A2 from 20 Sep, and today's level follows the "losing a level" rule
