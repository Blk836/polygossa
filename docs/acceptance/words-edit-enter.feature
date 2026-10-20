Feature: Enter saves a word's definition or meaning on Practice › Words (#180)
  The edit boxes were an input and a Save button with no form, so Enter did nothing and the typed text was lost
  on leaving.

  Scenario: Enter saves a definition
    Given a learning word with no definition on Practice › Words
    When I click "Add a definition…", type "dogs" and press Enter
    Then the box closes and the word shows "dogs"
    And after reloading the definition is still "dogs"

  Scenario: Enter saves an own-language meaning
    Given a word with a meaning in my own language
    When I edit the meaning, type a new one and press Enter
    Then the box closes and the new meaning is saved

  Scenario: The Save buttons keep working
    When I type a definition and click Save
    Then it is saved as before
