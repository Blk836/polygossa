Feature: Fixing the flaky tests
  About 20 tests fail now and then in a full run while passing alone, so nearly every pull request goes round twice
  and real failures hide among the noise. They fall into a few causes. Each is fixed at its cause, never by retrying
  or loosening what a test checks; a test leaves the "Flaky tests (tech debt)" list in CLAUDE.md only when it holds
  up under repetition.

  Background:
    Given the end-to-end servers are running on a loaded machine

  # --- 1. Acting before the page is ready --------------------------------------------------------------------
  # The page shows as HTML first and starts responding a moment later. Tests (and people on slow phones) can act in
  # that gap and nothing happens: the photo picker's file is lost, Escape isn't heard yet.

  Scenario: A photo picked as soon as Profile appears still opens the crop dialog
    Given the Profile page has just appeared and is still starting up
    Then "Change photo" can't be used until the page responds
    When it can and I pick an image
    Then the crop dialog opens every time

  Scenario: Escape closes a milestone the moment it appears
    Given a "500 words known" milestone has just appeared
    When I press Escape straight away
    Then the milestone closes

  Scenario: Tests wait until the page responds before acting
    Given a page has just loaded in a test
    Then the test's first action waits until the page signals it is ready

  # --- 2. The reader's page count changing while reading -----------------------------------------------------

  Scenario: Pages hold still while I read through a lesson
    Given a long lesson, with or without a video or the mini player
    When I read from the first page to the last without resizing the window or changing the text size
    Then the page count never changes and no page scrolls
    And this holds in 20 runs in a row

  Scenario: Pages still refit when the space really changes
    When I resize the window, change the text size or the video layout
    Then the pages refit and I keep my place, as now

  # --- 3. Tests that share one account ----------------------------------------------------------------------

  Scenario: A test that checks account-wide numbers can't be upset by others
    Given tests run in parallel on the shared test account, adding and removing known words
    When a test checks an account-wide number (known words, the all-time line)
    Then it uses an account of its own, or answers that number itself
    And it passes whatever the other tests are doing

  Scenario: Deleting an account leaves no way back in
    Given a test account of its own that I delete from Privacy
    Then asking who I am no longer answers as that account

  # --- 4. Tests that click the wrong thing ------------------------------------------------------------------

  Scenario: The word card's Close is the one clicked
    Given a word card and a status message are both on screen
    When a test closes the word card
    Then it clicks the word card's own Close button

  # --- 5. Timing limits on a loaded machine -----------------------------------------------------------------

  Scenario: The vocabulary map is quick, measured fairly
    Given a large vocabulary
    When the map is asked for three times
    Then the quickest answer comes within the same 1 second limit

  # --- 6. Failures with no known cause ----------------------------------------------------------------------

  Scenario: A failed page in a test run leaves its server error behind
    Given a test whose page shows "This page couldn't load"
    Then the run keeps the end-to-end servers' logs, so the cause can be found
    And a test whose cause is still unknown stays on the list, with what was learned

  # --- Done ---------------------------------------------------------------------------------------------------

  Scenario: A fixed test leaves the list
    Given a test from the list has had its cause fixed
    When it passes 20 times in a row alone and two full GitHub runs in a row pass with nothing flaky
    Then its line is removed from "Flaky tests (tech debt)"
