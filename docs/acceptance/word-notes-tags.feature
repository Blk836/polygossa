Feature: Notes and tags on my words (see docs/architecture/reading.md)
  Power users keep a personal note (a mnemonic, a grammar reminder) and tags on their words, and expect both in Anki.
  Every saved word or phrase can now have one plain-text note and up to 10 tags.

  Background:
    Given I am signed in and have saved the word "perro"

  # --- Notes ---

  Scenario: Adding a note
    When I PATCH the entry with note "Sounds like 'pear-o': a dog eating a pear"
    Then the entry's note is that text, and other fields are unchanged

  Scenario: Clearing a note
    Given the entry has a note
    When I PATCH it with note ""
    Then it has no note

  Scenario: A long note is cut to 2,000 characters
    When I save a note of 2,500 characters
    Then the stored note is its first 2,000 characters

  # --- Tags ---

  Scenario: Tags are normalized
    When I PATCH the entry with tags ["Animals", " animals ", "food-words", "A1"]
    Then its tags are ["animals", "food-words", "a1"] (lower-case, trimmed, duplicates removed, order kept)

  Scenario Outline: Invalid tags are refused
    When I PATCH the entry with tags <tags>
    Then I get 400 and the entry's tags are unchanged

    Examples:
      | tags                                       |
      | ["two words"]                              |
      | ["a,b"]                                    |
      | [""]                                       |
      | a tag of 31 characters                     |
      | 11 different tags                          |

  Scenario: Removing all tags
    When I PATCH the entry with tags []
    Then it has no tags
    And leaving tags out of a PATCH keeps them

  Scenario: Notes and tags when saving from the reader
    When a word is saved (POST) with a note and tags
    Then they are stored like an edit

  # --- Finding words ---

  Scenario: Filtering by tag
    Given "perro" is tagged "animals" and "gato" is tagged "animals" and "pets", and "comer" has no tags
    When I list my words with tag "animals"
    Then I get perro and gato only
    And tag "anim" matches nothing (whole tags only)

  Scenario: My tags
    When I request my tags for Spanish
    Then I get each tag with how many entries carry it, most used first: animals (2), pets (1)
    And another learner's tags never appear

  Scenario: Search covers notes
    Given "perro" has the note "pear"
    When I search for "pear"
    Then "perro" is found

  # --- Words page ---

  Scenario: Editing a note and tags on the Words page
    When I click "Add a note" on a word, type a note and tags "animals, pets" and save
    Then the word shows the note and the tags "animals" and "pets"
    And clicking a tag filters the list to that tag, and the filter can be cleared

  # --- Review and export ---

  Scenario: The note on the review card
    Given a learning word with a note is due
    When I reveal its answer in Review
    Then the note is shown under the definition

  Scenario: CSV export
    When I export CSV
    Then the last two columns are "note" and "tags" (tags separated by spaces)

  Scenario: Anki export
    When I export to Anki
    Then each note has a "Notes" field shown on the back of the card
    And the word's tags are added to the Anki note's tags, after "lector", the language and the status
