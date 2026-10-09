Feature: A word Amazon gives back unchanged is asked again inside its sentence (see docs/architecture/reading.md)
  Amazon Translate returns some words as they are: French "os" comes back as "os", "boitais" as "Boitais". Such words
  were stored as having no meaning, so every learner saw "No English meaning yet". Asked with the word marked inside
  its sentence ("Hier, je <b>boitais</b> dans la rue."), Amazon translates the sentence and keeps the mark around the
  matching words ("Yesterday I <b>was limping</b> in the street."), in every language pair. The words inside the mark
  become the word's meaning, stored and shared like any machine translation: each word is paid for once.
  Every language pair, words and selected phrases alike. Other behaviour is as in word-translations.feature.

  Background:
    Given machine translation is on, I am reading French, and my native language is English

  # --- Asking again in context ---

  Scenario: An echoed word is asked again inside its sentence
    Given nobody has looked up "boitais" before
    And Amazon Translate returns "Boitais" for "boitais"
    And returns "Yesterday I <b>was limping</b> in the street." for "Hier, je <b>boitais</b> dans la rue."
    When I click "boitais" in the sentence "Hier, je boitais dans la rue."
    Then Amazon Translate is asked twice: the word alone, then the marked sentence
    And the popup shows "was limping" labelled as a machine translation

  Scenario: The in-context meaning is shared like any machine translation
    Given "boitais" got the meaning "was limping" from one learner's sentence
    When another learner looks up "boitais" in a different sentence
    Then the popup shows "was limping" and Amazon Translate is not called

  Scenario: A word Amazon translates on its own is asked only once
    Given Amazon Translate returns "house" for "maison"
    When I look up "maison"
    Then Amazon Translate is asked once, without the sentence, and the popup shows "house"

  Scenario: Any language pair
    Given I am reading Spanish and my native language is French
    And Amazon Translate returns the word "cojeaba" unchanged
    When I click it in "Ayer cojeaba por la calle."
    Then it is asked again inside that sentence, Spanish to French, and the marked words are shown

  Scenario: A selected phrase is asked again the same way
    Given Amazon Translate returns the phrase I selected unchanged
    Then it is asked again with the phrase marked inside its sentence

  Scenario: The word I clicked is the one marked
    Given the sentence contains "os" twice
    When I click the second "os"
    Then the second "os" is the one marked

  Scenario: Punctuation and spacing around the marked answer are dropped
    Given the marked words come back as "<b> bone, </b>"
    Then the popup shows "bone"

  Scenario: Sentences with special characters
    Given the sentence contains "<", ">" or "&" (such as "Tom & Jerry")
    Then they are sent as text, not as marks, and the meaning shown contains no escape codes

  # --- When context doesn't help ---

  Scenario: The marked words come back unchanged, empty, or the mark is lost
    Given the in-context answer has no mark, an empty mark, more than one mark, or the word itself inside it
    Then the popup says "No English meaning yet"
    And that is stored, so Amazon Translate isn't asked about this word again, with or without a sentence

  Scenario: No sentence to ask with
    Given I look up an echoed word with no sentence around it (the sentence is only the word, or none was sent)
    Then the popup says "No English meaning yet"
    And the word stays open to an in-context ask the next time someone looks it up inside a sentence

  Scenario: Very long sentences
    Given the word's sentence is longer than 500 characters
    Then only the 500 characters around the word are sent, with the word marked

  # --- Failures, cap, older answers ---

  Scenario: The in-context ask fails or is slow
    Given Amazon Translate returns the word unchanged
    And the in-context ask fails or takes longer than 3 seconds
    Then the popup says "No English meaning yet"
    And the word stays open to an in-context ask the next time it is looked up

  Scenario: The in-context ask counts against the monthly cap
    Given an in-context ask is needed
    Then the characters of the marked sentence are counted against the monthly cap
    And once the cap is reached, it isn't sent and the word stays open to an in-context ask

  Scenario: Words stored as echoed before this change get asked in context
    Given production has words stored as having no meaning before this change (such as French "os")
    When a learner next looks one up inside a sentence
    Then it is asked in context once, without asking the bare word again
    And stored answers with a meaning are left as they are

  Scenario: Two learners look up the same echoed word at the same moment
    When two in-context asks for the same word run at once
    Then one meaning is stored and both learners see a meaning
