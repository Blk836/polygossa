Feature: French vocabulary map reaches B2 and C1
  The French word list stopped at B1 (~2,280 words). This adds the B2 and C1 bands, so the map's counts run up to
  ~4,000 words at B2 and ~8,000 at C1, as the vocabulary map's band targets always said. C2 is not added: the map's
  bands end at C1. Other languages are unchanged (still "coming soon"). The list is written into the repository
  like the A1-B1 one; nothing calls OpenAI, at build time or at runtime.

  Background:
    Given I am signed in, my target language is French and my native language is English

  # --- What learners see ---

  Scenario: The band switch offers every band up to C1
    When I open the map's band switch
    Then it offers "Up to A1", "Up to A2", "Up to B1", "Up to B2" and "Up to C1"
    And it never offers C2

  Scenario: Counting up to B2
    When I choose "Up to B2"
    Then every country, province and the header count the A1 to B2 words (about 4,000)
    And the C1 words show faintly as the next band: e.g. "+40 at C1"

  Scenario: At C1 there is no next band
    When I choose "Up to C1"
    Then every country, province and the header count all the words (about 8,000)
    And no country or province shows a next band, and nothing says "coming soon"

  Scenario: At B1 the next band is now a real count
    When I choose "Up to B1"
    Then countries and provinces show e.g. "+25 at B2" instead of "B2 words coming soon"

  Scenario: A learner's reading level picks the starting band
    Given my Reading level is B2
    Then the map counts up to B2 when I first open it
    Given my Reading level is C2
    Then the map counts up to C1, the highest band there is

  Scenario: A band remembered on this device still applies
    Given I had chosen "Up to B1" on this device before the new bands arrived
    Then the map still counts up to B1

  Scenario: The new words behave like the old ones
    Given "inquiétude" is a B2 word in Feelings & Mind with the forms "inquiétudes"
    When I mark "inquiétudes" known while reading
    Then "inquiétude" counts as known on the map up to B2
    When I tap its tile
    Then the panel shows "inquiétude", its English meaning, its band (B2) and my status
    And "Start learning" and "I know this" work on it as on any other map word

  Scenario: Advanced words sit at the edge of their province
    When I zoom into a province, counting up to A2
    Then the A1 and A2 words sit in its middle, B1 tiles paler around them, and B2 and C1 tiles paler still at the edge
    And at province zoom every tile, including the C1 ones, is large enough to tap and shows its word

  # --- Speed with about 8,000 words ---

  Scenario: Drawing all the words stays smooth
    Given the French list's ~8,000 words are on the map
    When I zoom and pan
    Then the map keeps moving smoothly
    And the countries keep their places from the A1-B1 map, only bigger, so it still looks like the same world

  Scenario: The map still loads quickly for a large vocabulary
    Given I have 30,000 vocabulary entries in French and the list has ~8,000 words
    When I open Progress
    Then the map answers in under a second

  # --- Keeping the list right (checked by tests, not seen by learners) ---

  Scenario: The French list has every band up to C1
    Then the French list's bands are exactly A1, A2, B1, B2 and C1
    And up to B2 it has between 3,400 and 4,600 words; up to C1 between 6,800 and 9,200

  Scenario: Every themed area grows at the new bands
    Then every area outside Core words has at least one B2 word and at least one C1 word in the French list
    And Core words' areas (pronouns, articles, question words, ...) may have none, since those word groups are
      small and closed and nearly all learned by B1

  Scenario: The new words follow the list's rules
    Then no headword appears twice in the French list, across all bands
    And no form belongs to two words
    And every new word names an area in the blueprint, has an English meaning, and no meaning is just the word
      copied unchanged (except where the list marks both languages spelling it the same)
    And no new form is an elided one (like "l'inquiétude")

  Scenario: Failure path: a word at a band the map doesn't know is reported
    Given a test list with a word at band "C2"
    Then the catalog reports that line as a problem and leaves the word out

  Scenario: The map doesn't depend on AI
    Given AI is switched off (no OpenAI key)
    Then the map shows every band up to C1 exactly the same
