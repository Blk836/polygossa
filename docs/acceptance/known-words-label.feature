Feature: The top bar's known-words counter says what it counts
  A green checkmark beside the number read as "done" or "saved" rather than "known words". The word "known" replaces it.

  Scenario: The counter reads "<count> known"
    Given I know 1234 words in the language I'm studying
    Then the top bar shows "1,234 known" with no checkmark icon
    And its accessible name and tooltip are "1,234 known words"
    And it still links to my Words page

  Scenario: The number stands out, the word doesn't
    Then the number is bold and the word "known" is in the muted text colour

  Scenario: Small counts
    Given I know 0 words
    Then the top bar shows "0 known"
