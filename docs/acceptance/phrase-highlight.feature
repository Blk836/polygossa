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
