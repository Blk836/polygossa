Feature: Anki decks with many note types
  A long-used Anki deck mixes note types (Basic, reversed, sentence cards, cloze, picture cards), each with its own
  fields. One word field per deck only fits the first note type, and the cards of every other type were skipped as
  "empty". So each note type in a deck gets its own word field: guessed from the field names, but always shown with
  example words for me to confirm, since a guess can pick the wrong side (English on the front is common). Cloze
  cards are not synced: they mostly test sentences, not single words.

  Background:
    Given I am signed in and connected to Anki

  # --- One setup per note type ---

  Scenario: Each note type in a deck is listed with its guess and examples
    Given a deck holds Basic, "Basic (and reversed card)" and "Sentence + Word" notes
    When I tick it in Settings → Anki
    Then each of its note types is listed with how many cards it has
    And each shows the word field guessed for it, three example words read with that field, and its meaning field
    And I can change its word field, or choose "Skip these cards"

  Scenario Outline: The guessed word field
    Given a note type with the fields <fields>
    Then its word field starts as <guess>
    And a field named Word, Target Word, Target, Vocab, Vocabulary, Term, Expression or Front wins, in that order,
      whatever its capitals; otherwise the first field

    Examples:
      | fields                          | guess                   |
      | Front, Back                     | Front                   |
      | Sentence, Word, Translation     | Word                    |
      | Expression, Meaning, Reading    | Expression              |
      | Sentence, Target Word, Audio    | Target Word             |
      | Picture, Vocab, Notes           | Vocab                   |
      | English, Spanish                | English (the first)     |

  Scenario: Fixing a wrong guess
    Given my Basic cards have English on the front, so the examples read "dog, cat, house"
    When I change that note type's word field to Back
    Then the examples read "perro, gato, casa"
    And once I save, Basic cards sync with their Back field

  Scenario: Cloze and picture-only note types start as skipped
    Given a deck holds a cloze note type, and a note type whose guessed field holds only images or sounds
    Then both start as "Skip these cards", saying why ("cloze cards test sentences" / "no written word")
    But I can still choose a word field for the picture type

  Scenario: Skipped note types are never read, and the preview says so
    Given a note type is set to "Skip these cards"
    When a preview or sync runs
    Then its cards are not read or sent to us
    And the preview and the result say how many cards were left out because their note type is skipped

  Scenario: A note type added to the deck later
    Given I set up a deck, and later add notes of a new type to it in Anki
    When a sync runs
    Then those cards are left out until I confirm the new type's word field
    And the Anki tab marks that note type "New: check its word field", and the result says how many cards waited

  Scenario: Decks set up before this change
    Given a deck saved with one word field for the whole deck
    Then the note types that have that field keep using it
    And every other note type waits, marked "New: check its word field", like one added later

  Scenario: Each note type's choice is kept with the deck
    Given I chose fields for a deck's note types on one computer
    When I sign in on another computer with Anki
    Then the same choices are used
