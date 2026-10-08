Feature: Word meanings in my own language: community meanings and machine translation (see docs/architecture/reading.md)
  English Wiktionary's translation tables give a learner's own-language meaning for only some words (6 of 22 common
  words in a live sample). So the word popup now looks in three places, in order:
    1. community meanings: what other learners with the same native language saved for the word, when at least two
       of them saved the same meaning (at most three, most common first);
    2. Wiktionary's translation tables, as before (free, and never wrong in the sample);
    3. machine translation (Amazon Translate, eu-west-1), asked once per word and language pair and stored for
       everyone, within a monthly spending cap ($20, counted in characters).
  Every plan gets it. A saved word now keeps its own-language meaning on its own, beside the English definition, so it
  can count towards community meanings.

  Background:
    Given I am signed in, my native language is Spanish, and I am reading German

  # --- Community meanings ---

  Scenario: Meanings other learners saved come first
    Given 3 Spanish-speaking learners saved "Hund" with the meaning "perro" and 2 saved it as "can"
    When I look up "Hund"
    Then the popup shows "perro, can" as meanings saved by other learners
    And no machine translation is requested

  Scenario: A meaning only one learner saved is not shown
    Given one learner saved "Hund" as "perrito lindo"
    When I look up "Hund"
    Then "perrito lindo" is not shown

  Scenario: Meanings saved for another native language don't mix in
    Given 5 French-speaking learners saved "Hund" as "chien"
    When I look up "Hund"
    Then "chien" is not shown

  Scenario: Meanings saved for another learning language don't mix in
    Given 2 Spanish-speaking learners learning Dutch saved "hond" as "perro"
    When I look up the German word "hond"
    Then "perro" is not shown

  Scenario: At most three community meanings
    Given four different meanings of "Hund", each saved by at least 2 learners
    Then the popup shows the three most common

  Scenario: My own saved meaning counts like anyone's
    Given I saved "Hund" as "perrito" and one other learner did too
    Then "perrito" counts as saved by 2 learners and is shown

  Scenario: A learner's personal note is never shared
    Given learners saved "Hund" with a personal note
    Then no note appears in anyone else's popup; only the meaning field is counted

  # --- What a saved word keeps ---

  Scenario: Saving a word keeps its own-language meaning separately
    Given the popup shows "perro, can" for "Hund"
    When I save "Hund"
    Then the word's own-language meaning is "perro" (the first one shown), in Spanish
    And its definition is stored as before ("perro, can — dog")

  Scenario: Picking another meaning in the popup
    Given the popup shows "perro, can" for "Hund"
    When I click "can"
    Then the word's own-language meaning becomes "can"

  Scenario: Editing my meaning on the vocabulary page
    Given I saved "Hund" with the meaning "perro"
    When I change its Spanish meaning to "perro (animal)" on the vocabulary page
    Then it counts as "perro (animal)" for community meanings, not "perro"

  Scenario: Clearing my meaning
    When I empty the meaning on the vocabulary page
    Then the word has no own-language meaning and counts for nothing

  Scenario: Words saved before this change don't count
    Given words saved before this change, with only the combined definition
    Then they have no own-language meaning and are not counted

  Scenario: The meaning remembers its language
    Given I saved "Hund" as "perro" while my native language was Spanish
    When I change my native language to French
    Then "perro" still counts only for Spanish speakers

  Scenario: English speakers are unchanged
    Given my native language is English
    When I look up "Hund"
    Then the popup shows the English definitions only, no machine translation is requested, and no meaning is saved

  # --- Machine translation ---

  Scenario: Wiktionary has the word's translations
    Given nobody saved "Hund" and Wiktionary's tables give "perro, can"
    When I look up "Hund"
    Then the popup shows "perro, can" as today
    And no machine translation is requested

  Scenario: First lookup of a word nobody saved and Wiktionary can't translate
    Given nobody saved "Kühlschrank" and Wiktionary gives no Spanish translation
    When I look up "Kühlschrank"
    Then Amazon Translate is asked once, German to Spanish
    And the popup shows "refrigerador" labelled as a machine translation
    And the answer is stored

  Scenario: A word no dictionary has still gets a machine translation
    Given no dictionary has an entry for "Kühlschränkchen"
    When I look up "Kühlschränkchen"
    Then the popup shows Amazon's translation, labelled as a machine translation
    And says no dictionary entry was found

  Scenario: Later lookups reuse the stored answer
    Given "Kühlschrank" German to Spanish is stored
    When any learner looks up "Kühlschrank"
    Then Amazon Translate is not called

  Scenario: Stored answers survive a restart
    Given "Kühlschrank" German to Spanish is stored
    When the backend restarts
    Then the stored answer is still used

  Scenario: Same word, another native language
    Given "Kühlschrank" German to Spanish is stored
    When a French-speaking learner looks it up
    Then Amazon Translate is asked for German to French

  Scenario: A translation that is just the word isn't shown
    Given Amazon returns the word unchanged (a name, say)
    Then no machine translation is shown, and that is stored so Amazon isn't asked again

  Scenario: Community meanings take over once they exist
    Given "Kühlschrank" has a stored machine translation "refrigerador"
    And 2 learners saved it as "nevera"
    When I look up "Kühlschrank"
    Then the popup shows "nevera" as a community meaning

  Scenario: Two learners look up the same new word at the same moment
    When two lookups of an unstored word run at once
    Then one answer is stored and both learners see it

  # --- Failures and limits ---

  Scenario: Amazon Translate fails or is slow
    When Amazon Translate fails, or takes longer than 3 seconds
    Then the popup still shows the dictionary definitions and "No Spanish translation found"
    And nothing is stored, so the next lookup tries again

  Scenario: Monthly cap reached
    Given this month's characters sent to Amazon Translate have reached the cap
    When I look up a word with no stored answer
    Then Amazon Translate is not called and the popup shows what the dictionaries have
    And community meanings and stored answers still show

  Scenario: The cap resets each month
    Given the cap was reached in October
    When it is 1 November (UTC)
    Then machine translation works again

  Scenario: Machine translation not set up
    Given the backend has no translation settings (development, backend tests, browser tests)
    When I look up a word
    Then no call is made to AWS and the popup works as it did before

  Scenario: Production has it switched on
    Given the production stack
    Then the backend may call Amazon Translate's TranslateText, and nothing else of Translate
    And machine translation is switched on, with the $20 monthly cap
