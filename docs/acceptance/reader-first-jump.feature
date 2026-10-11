Feature: A learner's first jump in the audio is never undone by the page's start position (#117)
  When a text with audio opens, the audio is placed at the start of the page being read. If the learner jumped
  (with ] or [, or by playing from a word) just as the audio finished loading, that placement could land a moment
  later and put the audio back at the page's start, so the jump was lost. The reader test for ] turning the page
  failed now and then because of it.

  Scenario: A jump just as the audio's length becomes known stays
    Given a text with synced audio is opening
    When I press ] at the moment the player shows the audio's length
    Then the audio moves to the next sentence
    And nothing moves it back to the start of the page afterwards

  Scenario: Opening a text still places the audio at the page I'm on
    Given I open a text at a later page and haven't touched the audio
    When its audio loads
    Then the audio waits at the start of that page, as before

  Scenario: Stepping through sentences with ] turns the page
    When I press ] once per sentence on the first page
    Then the next page shows, with its first word being spoken
