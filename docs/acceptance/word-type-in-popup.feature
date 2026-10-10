Feature: The popup says what kind of word it is: noun, verb and tense, adjective, adverb and so on
  Learners asked to see the word's type beside its meaning. The AI is already asked for the clicked word's meaning in
  its sentence, so the same request now also returns the type, the form it has there (a verb's tense, a noun's or
  adjective's gender and number) and its dictionary form. Checked on 16 French sentences: gpt-4o-mini got verb tenses
  wrong ("avait" as a past participle, "viennes" as present instead of present subjunctive); gpt-4.1-mini got them
  right, at about $0.0001 a click instead of $0.00004, so this request moves to gpt-4.1-mini.

  Background:
    Given I am reading French, my native language is English, and the AI is set up

  # --- What the popup shows ---

  Scenario: A verb shows its tense and dictionary form
    When I click "irons" in "Nous irons demain."
    Then the popup shows the meaning "will go"
    And under it "verb · future, 1st person plural · from aller"

  Scenario: A noun shows its gender and number
    When I click "tapis" in "On dit tirer le tapis."
    Then under the meaning it shows "noun · masculine singular"

  Scenario: An adjective shows its gender, number and dictionary form
    When I click "belles" in "Ces maisons sont belles."
    Then under the meaning it shows "adjective · feminine plural · from beau"

  Scenario: A word with no form to show shows only its type
    When I click "lentement" in "Il parle lentement."
    Then under the meaning it shows "adverb"

  Scenario: A selected phrase shows "phrase"
    When I select "en train de" in "Il est en train de manger."
    Then under the meaning it shows "phrase"

  Scenario: The dictionary form is left out when it is the word itself
    Given the AI gives "tapis" as the dictionary form of "tapis"
    Then the popup doesn't show "from tapis"

  Scenario: The labels are in English
    Given my native language is Spanish
    Then the meaning is in Spanish and the word type line is in English, like the rest of the app

  # --- When there is no type ---

  Scenario: Meanings that don't come from the AI in this sentence have no type line
    Given the meaning shown comes from Amazon Translate or from other learners (the AI is off, failed, or there is no sentence)
    Then the popup shows no word type line

  Scenario: An answer with an unknown type shows no type line
    Given the AI gives a type that isn't one of noun, verb, adjective, adverb, pronoun, preposition, conjunction,
      determiner, interjection, number or phrase
    Then the popup shows the meaning without a type line

  Scenario: Overlong form or dictionary form are left out
    Given the AI gives a form or a dictionary form longer than 40 characters
    Then that part is left out and the rest of the line is shown

  Scenario: My own saved meaning leads, and the type line still shows
    Given I saved my own meaning for the word
    When I click it in a sentence
    Then my meaning is the headline and the word type line is the one for this sentence

  # --- Saving and practice ---

  Scenario: Saving the word keeps its type
    When I click "irons" in a sentence and save it
    Then the saved word's type is "verb · future, 1st person plural · from aller"
    And the Words page and the review cards show it, where they already show a word's type

  Scenario: A type I already have isn't overwritten
    Given my saved word already has a type
    When I pick another meaning for it in the popup
    Then its type stays as it was

  # --- Stored answers ---

  Scenario: The type is stored with the meaning and shared like it
    Given one learner clicked "irons" in a sentence
    When another learner clicks it in the same sentence
    Then they see the same meaning and type line, and the AI is not asked

  Scenario: Meanings stored before this change are asked again
    Given a meaning in a sentence was stored before this change, without a type
    When it is looked up again
    Then the AI is asked again, so the type line appears
