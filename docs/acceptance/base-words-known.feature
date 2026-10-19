Feature: Base words known, shown alongside all forms known (#174)
  The known-word count counts every spelling, so "parle", "parlons" and "parlé" are three known words and "beau",
  "belle" and "beaux" three more. Learners now also see how many base words (word families) they know, and choose
  which of the two numbers the honey jar in the top bar shows. A form's base word comes from what the app already
  has, with no new AI calls: the dictionary form the in-sentence meaning lookup returns when a word is clicked, and
  the forms listed in the vocabulary map's word lists. A form with no known base word counts as its own base word, so
  the base-word number can be a little high but is never higher than the all-forms number.

  Background:
    Given I am reading French, my native language is English, and the AI is set up

  # --- Where a form's base word comes from ---

  Scenario: Clicking a form saves its base word with it
    When I click "parlons" in "Nous parlons français."
    And the popup shows "verb · present, 1st person plural · from parler"
    Then my saved word "parlons" has the base word "parler"

  Scenario: A form that is already its base word is saved as its own base word
    When I click "parler" in "Il faut parler."
    And the popup shows "verb · infinitive" with no "from …"
    Then my saved word "parler" has the base word "parler"

  Scenario: A form whose lookup gave no word type has no base word yet
    Given the AI did not answer for "chantons", so the popup shows a machine translation
    When I click "chantons" in "Nous chantons."
    Then my saved word "chantons" has no base word
    And it counts as its own base word

  Scenario: The base word is stored in the same form as the words it groups
    When I click "Belles" in "Belles maisons."
    And the popup shows "adjective · feminine plural · from Beau"
    Then my saved word "belles" has the base word "beau"

  Scenario: Words marked known without a click have no base word
    When I turn the page and its unclicked words become known
    Then those words have no base word
    And each counts as its own base word, unless the vocabulary map's lists name its base word

  Scenario: The vocabulary map's word lists group the forms they list
    Given the French word lists give "dilemme" with the form "dilemmes"
    And I know "dilemmes", saved with no base word
    Then "dilemmes" counts towards the base word "dilemme"

  Scenario: A base word saved from a click beats the word lists
    Given the word lists give "suis" as a form of "suivre"
    And my saved word "suis" has the base word "être" from a click in "Je suis content."
    Then "suis" counts towards "être"

  Scenario: Looking a word up again after it is saved fills in a missing base word
    Given my saved word "chantons" has no base word
    When I click "chantons" again and the popup shows "from chanter"
    Then my saved word "chantons" has the base word "chanter"

  # --- Words already saved before this change ---

  Scenario: Words already saved get their base word from earlier lookups
    Given before this change I saved "allons", and a lookup of "allons" in a sentence gave the base word "aller"
    When the update is installed
    Then my saved word "allons" has the base word "aller"
    And no AI call is made

  Scenario: An earlier lookup with a word type and no base word makes the word its own base word
    Given before this change a lookup of "aller" gave a word type and no base word
    When the update is installed
    Then my saved word "aller" has the base word "aller"

  Scenario: When earlier lookups disagree, the most frequent base word wins
    Given earlier lookups of "suis" gave "être" in three sentences and "suivre" in one
    When the update is installed
    Then my saved word "suis" has the base word "être"

  Scenario: A tie between earlier lookups goes to the alphabetically first base word
    Given earlier lookups of "suis" gave "être" once and "suivre" once
    When the update is installed
    Then my saved word "suis" has the base word "suivre", the first of the two in character order

  Scenario: Earlier lookups in another language are not used
    Given a Spanish lookup of "fue" gave "ir", and I saved the French word "fue"
    When the update is installed
    Then my French "fue" has no base word

  # --- Counting ---

  Scenario: Forms of one base word count once as base words
    Given I know "parle", "parlons" and "parlé", each saved with the base word "parler"
    And I know "beau", "belle" and "beaux", each saved with the base word "beau"
    Then I know 6 forms and 2 base words

  Scenario: A base word counts when any of its forms is known, even if the base form itself is not
    Given I know "allons" with the base word "aller", and I have not saved "aller"
    Then "aller" counts as a base word I know

  Scenario: Only known forms count
    Given I know "parle" with the base word "parler"
    And "parlons" with the base word "parler" is learning, and "parlez" is ignored
    Then I know 1 form and 1 base word

  Scenario: A phrase counts once in both numbers
    Given I know the phrase "tout à fait"
    Then it adds 1 to all forms known and 1 to base words known

  Scenario: Base words are counted per language
    Given I know French "parle" with base word "parler" and Spanish "parle" with base word "parlar"
    Then each language's base words counts its own, and all languages together count 2

  Scenario: Base words are never more than forms
    Given any mix of known words with and without base words
    Then base words known is at most all forms known

  # --- The honey jar setting ---

  Scenario: The honey jar shows all forms known by default
    Given I know 6 forms and 2 base words, and I have never changed the setting
    Then the honey jar shows "6 known"
    And its tooltip says "6 known words (all forms)"

  Scenario: Choosing base words in Settings changes the honey jar
    When I open Settings and choose "Base words" under "Honey jar"
    Then the honey jar shows "2 known"
    And its tooltip says "2 known base words"

  Scenario: The choice is saved to my account
    Given I chose "Base words"
    When I sign in on another device
    Then the honey jar shows base words there too

  Scenario: Choosing all forms again goes back to today's number
    Given I chose "Base words"
    When I choose "All forms"
    Then the honey jar shows "6 known"

  Scenario: Saving the setting fails
    Given the server refuses to save the setting
    When I choose "Base words"
    Then Settings shows the error, and the choice and the honey jar stay as they were

  Scenario: In base-word mode, a new form of a known base word does not raise the jar
    Given the honey jar shows base words and I know "parle" with the base word "parler"
    When I mark "parlons" known after its popup showed "from parler"
    Then the honey jar still shows the same number once the counts refresh

  Scenario: In base-word mode, a form of a new base word raises the jar
    Given the honey jar shows base words
    When I mark "chantons" known after its popup showed "from chanter", and I know no other form of "chanter"
    Then the honey jar goes up by one

  Scenario: In all-forms mode, the jar still rises by one for every word marked known
    Given the honey jar shows all forms
    When I mark "parlons" known
    Then the honey jar goes up by one, as it does today

  Scenario: A milestone already celebrated is not celebrated again after switching
    Given I was shown the 100-words milestone while the jar showed all forms
    When I switch to base words, which shows 60, and later reach 100 base words
    Then the 100-words milestone is not shown again

  # --- Elsewhere ---

  Scenario: The dashboard shows both numbers
    Given I know 6 French forms and 2 French base words
    When I open the dashboard
    Then the known-words card shows 6 known words and "2 base words"
    And the totals line at the bottom says "6 known words · 2 base words"

  Scenario: A teacher sees both numbers for each student
    Given I teach a class whose student knows 6 French forms and 2 French base words
    When I open the class's progress
    Then the student's row shows 6 known words and 2 base words
    And the class average shows both

  Scenario: The growth chart and daily activity counts still count forms
    When I open the dashboard
    Then the growth chart's line and the activity "words known" figures count forms, as today
