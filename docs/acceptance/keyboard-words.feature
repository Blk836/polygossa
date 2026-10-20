Feature: Reader words can be looked up from the keyboard (#192)
  No word in the reader could take focus, so without a mouse or touch nothing could be looked up or saved.

  Scenario: One Tab stop for the text, on its first word
    Given a text open in the reader, nothing clicked
    When I press Tab from the reader's header buttons
    Then focus lands on the first word on the page, shown with a focus ring
    And pressing Tab again leaves the text (it is one stop, not one per word)

  Scenario: Enter or Space opens the word's card
    Given focus on a word
    When I press Enter
    Then that word's card opens, as a click would
    And the card is a dialog named after the word
    When I press Escape
    Then the card closes and focus is still on the word
    When I press Space
    Then the card opens again

  Scenario: Arrows move between words without turning the page
    Given focus on the first word and no card open
    When I press → twice
    Then focus is on the third word, and the page hasn't changed
    When I press ←
    Then focus is on the second word

  Scenario: With a card open, arrows move the card and focus together
    Given the card of a focused word is open
    When I press →
    Then the next word's card opens and focus moves to that word

  Scenario: Tab returns to the word last focused
    Given I moved focus to the fifth word, then tabbed away
    When I shift-tab back into the text
    Then focus lands on the fifth word

  Scenario: Arrows still turn the page when focus isn't on a word
    Given no word focused and no card open
    When I press →
    Then the next page shows, as before
