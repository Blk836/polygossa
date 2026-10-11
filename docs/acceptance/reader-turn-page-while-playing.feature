Feature: Turning the page while audio plays keeps the page you turned to
  Bug #118: with a lesson's audio playing, pressing Next (or the arrow keys) turned the page, then the reader jumped
  straight back, because every newly spoken word sent the reader to the page holding it. A page the learner turns to
  by hand now wins: the audio moves to that page instead of pulling the reader back.

  Background:
    Given a lesson with synced audio that spans several pages
    And I am reading it

  Scenario: Next while playing stays on the next page and plays from its start
    Given the audio is playing on page 1
    When I press Next page
    Then I stay on page 2, also after the audio has spoken several more words
    And the audio keeps playing from the first word of page 2
    And the word being spoken is highlighted on page 2

  Scenario: Previous while playing stays on the previous page and plays from its start
    Given the audio is playing on page 2
    When I press Previous page
    Then I stay on page 1
    And the audio keeps playing from the first word of page 1

  Scenario: The arrow keys behave like the buttons
    Given the audio is playing on page 1 and no word is open
    When I press the right arrow key
    Then I stay on page 2 and the audio plays from its start

  Scenario: Turning the page while paused, then pressing Play, plays the page I am on
    Given I played part of page 1 and paused
    When I press Next page and then Play
    Then I stay on page 2
    And the audio plays from the first word of page 2

  Scenario: Playback still turns the page by itself at the end of a page
    Given the audio is playing near the end of page 1
    When the spoken word moves onto page 2
    Then the reader turns to page 2 once and stays there

  Scenario: Stepping sentence by sentence still follows across pages
    Given the audio is on the last sentence of page 1
    When I step to the next sentence with "]"
    Then the reader turns to page 2 with that sentence's first word highlighted

  Scenario: Video lessons behave the same
    Given a video lesson whose transcript spans several pages, playing on page 1
    When I press Next page
    Then I stay on page 2 and the video jumps to the first line of page 2

  Scenario: Turning the page marks the page known as before
    Given marking pages known is on, and the audio is playing on page 1
    When I press Next page
    Then page 1's remaining new words are marked known once, exactly as Next does without audio
