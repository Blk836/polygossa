Feature: Amazon Translate is gone; the vocabulary map asks the AI for a word on its own

  The map's word panel was the last thing using Amazon Translate. It now asks the AI instead,
  and the app no longer talks to Amazon Translate at all.

  Background:
    Given I learn French and my own language is Polish
    And I have opened an area of the vocabulary map

  Scenario: The map's list already has a meaning in my language
    When I click a word whose meaning the map's list has in Polish
    Then the panel shows that meaning
    And nothing is looked up

  Scenario: A word I saved a meaning for
    When I click a word I saved with my own meaning
    Then the panel shows my meaning
    And nothing is looked up

  Scenario: Other learners shared a meaning
    Given the map's list has no Polish meaning for "pomme"
    And enough learners saved the same Polish meaning for it
    When I click "pomme"
    Then the panel shows the shared meaning
    And the AI is not asked

  Scenario: Nobody has a meaning, so the AI gives the word's common meanings
    Given the map's list has no Polish meaning for "banco"
    And nobody shared one
    When I click "banco"
    Then the AI is asked once, with the word on its own and no sentence
    And it is asked for the word's most common meanings, most common first, as a short Polish gloss
    And the panel shows its answer, for example "bank, ławka"
    And it does not use my daily AI allowance, on any plan

  Scenario: The AI's answer is saved and reused for everyone
    Given the AI already gave a Polish meaning for the French "banco" on its own
    When I, or any other learner with Polish as their own language, click "banco" on the map
    Then the saved meaning is shown
    And the AI is not asked again

  Scenario: A saved word-on-its-own meaning never leaks into the reader
    Given the AI already gave a meaning for "banco" on its own
    When I click "banco" inside a sentence in the reader
    Then the reader asks for its meaning in that sentence, as it does today

  Scenario: The AI fails, times out or gives an unusable answer
    Given nobody has a meaning for "banco"
    When I click "banco" and the AI fails, or answers with no meaning or one over 100 characters
    Then the panel says "No meaning found"
    And nothing is saved, so clicking it again later asks again

  Scenario: The AI is switched off
    Given the app runs without an OpenAI key
    When I click a word nobody has a meaning for
    Then the panel says "No meaning found"
    And no other translation service is asked

  Scenario: Starting learning a word saves the meaning shown
    Given the AI gave "bank, ławka" for "banco"
    When I press "Start learning"
    Then "banco" is saved as learning with the meaning "bank, ławka"

  Scenario: The reader is unchanged
    When I click a word in the reader
    Then its meaning comes from the AI in its sentence, or from other learners, as it does today
    And Amazon Translate is never asked

  Scenario: Amazon Translate is removed from the app
    Then the backend has no Amazon Translate client, no monthly character cap and no AWS Translate package
    And its settings (TRANSLATION_ENABLED, TRANSLATION_REGION, TRANSLATION_MONTHLY_CHARACTER_CAP and its price) are gone
    And a backend still started with TRANSLATION_ENABLED=true starts normally and ignores it
    And production's infrastructure no longer allows the backend to call Amazon Translate
    And the live check that called the real Amazon Translate is removed with it

  Scenario: Stored machine translations are dropped
    Given words were translated by Amazon Translate before this change
    When the database is upgraded
    Then the stored machine translations and the monthly character usage are deleted
    And meanings learners saved to their own words from a machine translation are kept
    And a word that was machine-translated is asked of the AI the next time it is clicked on the map

  Scenario: The admin Translations tab shows only what still exists
    Given I am an admin on the Translations tab
    Then it no longer shows the Amazon Translate month line, "Amazon calls", "Characters" or "Over the cap"
    And the lookup kinds are "AI, stored", "AI, new", "Community" and "Nothing found", without the two machine kinds
    And the hit rate counts stored AI and community answers
    And the cost counts AI tokens only
    And "Stored so far" no longer lists machine-translated words
    And a map lookup the AI answers counts as "AI, new", and one answered from a saved meaning as "AI, stored"

  Scenario: Lookup counts from before the change
    Given lookups were counted as machine-translated before this change
    When the database is upgraded
    Then those lookups are deleted from the counts, and every other kind is kept
