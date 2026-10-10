Feature: A selected phrase is highlighted as one band
  Dragging across words selects them as a phrase and opens its popup, but each word was drawn as its own outlined box
  with the spaces between them left plain, so a phrase looked like separate words. Reproduced in Chrome by dragging
  across three words of a text.

  Scenario: Dragging across words highlights them as one continuous band
    When I drag across three words in the reader
    Then the words and the spaces between them are highlighted in one colour, with no gaps
    And there is no outline around each word: the band is rounded only at its two ends

  Scenario: The band follows the drag
    While I am still dragging
    Then the band already covers every word from where I started to where the pointer is, and the spaces between

  Scenario: Punctuation inside the phrase is part of the band
    When I select "Bon, d'accord" across the comma
    Then the comma and the space after it are inside the band

  Scenario: Text outside the phrase isn't highlighted
    When I select the second to fourth words of a sentence
    Then the space before the second word and the space after the fourth are not highlighted

  Scenario: A phrase across two lines
    When the phrase wraps onto the next line
    Then each line's part is highlighted, and the ends are rounded only at the phrase's first and last word

  Scenario: A single clicked word looks as it does today
    When I click one word
    Then it is highlighted as one rounded box, as before

  Scenario: Works in light and dark themes, and with word colours off
    Then the band uses the theme's selection colour in light and dark themes, and in quiet mode

  # --- Clicking a saved phrase (reproduced in Chrome: a click inside a saved phrase opened only the word) ---

  Scenario: Clicking a word of a saved phrase opens the phrase
    Given I saved "en train de" as a phrase
    When I click "train" in "Il est en train de manger."
    Then the popup opens for the phrase "en train de", with its meaning and its status
    And the whole phrase is highlighted as one band

  Scenario: Clicking the same word again opens just that word
    Given the popup is open for the phrase "en train de" after I clicked "train"
    When I click "train" again
    Then the popup opens for the word "train" alone

  Scenario: Clicking another word of the same phrase keeps the phrase open
    Given the popup is open for the phrase "en train de"
    When I click "de"
    Then the phrase popup stays open

  Scenario: A word in two saved phrases opens the longer one
    Given I saved "en train" and "en train de" as phrases
    When I click "train"
    Then the popup opens for "en train de"

  Scenario: Words outside any saved phrase open as before
    When I click a word that is in no saved phrase
    Then the popup opens for that word

  Scenario: Phrases I marked known or ignored don't capture clicks
    Given I saved a phrase as known or ignored (it isn't underlined)
    When I click one of its words
    Then the popup opens for that word, as before

  Scenario: A saved phrase is underlined as one line
    Given I saved a phrase I'm learning
    Then its underline runs under the words and the spaces between them, without gaps

  Scenario: Selecting a new phrase across a saved one still works
    When I drag across words that include part of a saved phrase
    Then the new selection is opened as a phrase, as before
