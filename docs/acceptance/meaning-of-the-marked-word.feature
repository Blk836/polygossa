Feature: The meaning in a sentence is the meaning of the clicked word only
  The reader's popup asked the AI for the marked word's meaning "as used in this text", and it answered with the
  expression around the word: "tapis" in "On dit tirer le tapis" became "pull the rug", "coupé" in "Il m'a coupé la
  parole" became "cut me off". A learner who clicks one word wants that word's meaning; a phrase they want translated
  whole they select. Checked against gpt-4o-mini on 15 French sentences before and after.

  Background:
    Given I am reading French, my native language is English, and the AI is set up

  Scenario: A word inside an idiom gets its own meaning
    When I click "tapis" in "On dit tirer le tapis sous les pieds de quelqu'un."
    Then the AI is told to translate only the marked word, never the unmarked words around it, even in an idiom
    And the popup shows the word's own meaning, such as "rug" or "carpet", not "pull the rug"

  Scenario: The sense still follows the sentence
    When I click "Debout" in "Debout, les enfants !"
    Then the popup shows the sense it has there, such as "up", not "standing"

  Scenario: A selected phrase is still translated whole
    When I select "en train de" in "Il est en train de manger."
    Then the popup shows the phrase's meaning, such as "in the process of"

  Scenario: Meanings stored under the old instructions are asked again
    Given "tapis" in that sentence has the stored meaning "pull the rug" from before this change
    When I click "tapis" in that sentence
    Then the AI is asked again and the popup shows its new answer
    And any later change to the AI's instructions likewise asks again instead of reusing older answers
