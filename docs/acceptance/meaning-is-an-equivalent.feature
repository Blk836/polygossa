Feature: The popup meaning is a dictionary equivalent, not a definition

  Scenario: A word with a one-word equivalent gets that word
    Given the sentence "C'est incomparablement plus beau que l'original."
    When I click "incomparablement"
    Then the meaning is "incomparably", not "in a way that cannot be compared"

  Scenario: A word with no one-word equivalent gets a short phrase
    Given the sentence "Le dépaysement était total."
    When I click "dépaysement"
    Then the meaning is a short phrase such as "change of scenery", not a sentence-long explanation

  Scenario: The AI is told to give equivalents
    When the backend asks the AI for a word's meaning
    Then its instructions ask for the dictionary equivalent in as few words as possible, never a definition,
      with the incomparablement example

  Scenario: Earlier answers are asked again
    Given "incomparablement" in that sentence was answered "in a way that cannot be compared" before the change
    When anyone clicks it after the change
    Then the AI is asked again and the new answer is shown

  Scenario: A word spelled the same in both languages gets its meaning
    Given the sentence "Quelle satisfaction de finir ce livre !"
    And the AI answers "satisfaction", noun, feminine singular
    When I click "satisfaction"
    Then the popup shows "satisfaction" with "noun · feminine singular"
    And that answer is cached for everyone like any other

  Scenario: Case doesn't matter
    Given the AI answers "Satisfaction" for "satisfaction"
    Then the popup shows it

  Scenario: Amazon sending the word back unchanged still counts as no answer
    Given the AI doesn't answer in time
    And Amazon Translate returns "satisfaction" unchanged
    Then the popup says no translation was found, as today

  Scenario: A meaning already saved to Words is kept
    Given I saved "incomparablement" with "in a way that cannot be compared"
    Then my saved meaning is not changed
