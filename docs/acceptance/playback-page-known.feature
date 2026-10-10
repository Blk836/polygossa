Feature: Turning the page during playback marks it known, like clicking Next
  When audio or video playback carried the reader onto the next page, the page just read was never marked known, so
  its new words stayed new and the known-word count in the top bar didn't move (issue #96).

  Background:
    Given I'm reading a text of several pages that has synced audio (or is a video)
    And "Mark page as known when turning" is on (the default)

  Scenario: Playback turns the page by itself
    Given page 1 has words I've never seen
    When the audio plays past the end of page 1 and the reader turns to page 2
    Then page 1's new words are marked known, exactly as if I'd clicked Next
    And the known-word count in the top bar goes up without a reload

  Scenario: Stepping to the next sentence across the page end
    When I press "]" on the last sentence of page 1 and the reader turns to page 2
    Then page 1's new words are marked known and the count updates

  Scenario: The setting is off
    Given "Mark page as known when turning" is off
    When playback turns to the next page
    Then no words are marked known and the count stays the same

  Scenario: Playback goes back a page
    When playback (or "[") moves back from page 2 to page 1
    Then nothing is marked known

  Scenario: A jump that skips pages
    When I jump from page 1 straight to page 3 (e.g. clicking a later line in a video transcript)
    Then nothing is marked known, same as jumping pages by hand

  Scenario: Nothing new on the page
    Given every word on page 1 is already known or being learned
    When playback turns to page 2
    Then nothing is saved and the count stays the same

  Scenario: Saving fails
    Given marking the page known fails on the server
    When playback turns to page 2
    Then the reader still follows the audio onto page 2 and shows the error
