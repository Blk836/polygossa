Feature: Words joined by an apostrophe are one word
  French and Italian elisions used to be split at the apostrophe ("c'est" → "c'" + "est"), so clicking one gave
  half a word. Like every other language, a word joined by an apostrophe is now one word.

  Scenario: French elision stays one word
    Given a French text "C'est l'homme qu'il aime, aujourd'hui."
    When I open it in the reader
    Then the words are "C'est", "l'homme", "qu'il", "aime", "aujourd'hui"
    And clicking "l'homme" looks up and saves "l'homme" as one word

  Scenario: Italian elision stays one word
    Given an Italian text "dell'anno"
    Then it is one word "dell'anno"

  Scenario: Curly apostrophes behave the same as straight ones
    Given a French text "l’eau"
    Then it is one word, saved the same as "l'eau"

  Scenario: An apostrophe not between letters is still punctuation
    Given a French text "'Bonjour' dit-il, les enfants' jeux"
    Then the words are "Bonjour", "dit-il", "les", "enfants", "jeux"

  Scenario: Other languages are unchanged
    Given English "Don't touch John's dog" and German "gibt's"
    Then they split exactly as before

  Scenario: Texts imported before the change
    Given a French text imported while elisions were split, with audio timings and a reading position
    When the app starts after the release
    Then "c'est" shows as one word there too
    And its word counts and level are recalculated
    And the audio or video highlight still follows the same words
    And a learner resumes at the same place in the text
    And texts that are already right are left untouched

  Scenario: Words saved before the change
    Given I saved "l'" as a word before the change
    Then it stays in my vocabulary and is not deleted

  Scenario: The vocabulary map no longer lists elided forms
    Given the French word list
    Then no form ends in an apostrophe ("j'", "l'", "qu'" …)
    And a list form with an apostrophe in the middle is accepted as one word
