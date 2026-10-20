Feature: Shift-click makes a phrase without a stray browser selection (#182)
  Shift-click is how a phrase is selected, but the browser also extended its own text selection from the last
  click, leaving unrelated text highlighted.

  Scenario: Shift-click after closing a word
    Given a text open in the reader
    When I click a word, press Escape, click beside the text, click another word and shift-click a word further along
    Then the phrase card opens for the words between
    And no browser text selection remains on the page

  Scenario: Shift-click right after clicking a word
    When I click a word and shift-click a later one
    Then the phrase card opens and nothing is selected by the browser
