Feature: The meaning is the headline of the word popup
  The popup used to show the meaning in one line with a language label and a source note around it
  ("English attainment · machine translation"), all at the same size, so the meaning itself got lost. The language
  label goes, since the popup always answers in the learner's own language. The first meaning becomes large and stands
  alone, other meanings move to a smaller "also" line, and the source note stays visible, small, under the meanings.
  Lookups, saving and the community/machine rules are unchanged (word-translations.feature, lingq-style-lookup.feature).

  Background:
    Given I am signed in, my native language is English, and I am reading Spanish

  Scenario: One meaning, from machine translation
    Given the lookup for "logro" gives the machine translation "attainment"
    When I click "logro"
    Then the popup shows "attainment" large, on its own line, right under the word
    And no "English" label appears anywhere in the popup
    And there is no "also" line
    And a small muted note under it says "machine translation"

  Scenario: Several meanings
    Given the lookup for "perro" gives "dog, hound, cur"
    When I click "perro"
    Then "dog" is shown large as the headline
    And a smaller line under it reads "also: hound · cur"

  Scenario: Meanings other learners saved
    Given the lookup for "perro" gives community meanings "dog, hound"
    When I click "perro"
    Then "dog" is the headline, "also: hound" is under it
    And the small note says "saved by other learners"

  Scenario: A meaning with no known source shows no note
    Given the lookup gives a meaning with neither a community nor a machine source
    Then the headline and "also" line show, and there is no source note

  Scenario: Picking another meaning makes it the headline
    Given the popup shows "dog" as the headline and "also: hound · cur"
    When I click "hound"
    Then "hound" becomes the headline and the line reads "also: dog · cur"
    And the word's own-language meaning is saved as "hound", as before

  Scenario: The saved meaning is the headline when I reopen the word
    Given I saved "perro" with the meaning "hound"
    When I click "perro" again
    Then "hound" is the headline, even if the lookup lists "dog" first

  Scenario: Picking the headline again changes nothing
    Given "dog" is the headline
    When I click "dog"
    Then the meaning stays "dog" and the order doesn't change

  Scenario: No meaning yet
    Given the lookup for a word finds no English meaning
    When I click it
    Then the popup says "No English meaning yet" in muted text, as before (the language name stays here)
    And there is no headline, "also" line or source note

  Scenario: A long meaning
    Given the headline meaning is a long phrase
    Then it wraps inside the popup without widening it or scrolling sideways, on a phone width too

  Scenario: Phrases work the same
    Given I select the phrase "sin embargo" and its lookup gives "however, nevertheless"
    Then "however" is the headline and "also: nevertheless" is under it

  Scenario: The meaning is still being looked up, or the lookup failed
    Then the popup shows the spinner while loading, and the error message on failure, as before

  Scenario: Keyboard and screen readers
    Then the headline and each "also" meaning are buttons, the current meaning is marked as pressed
    And the meanings are announced in order without the "also" word being read as a meaning
