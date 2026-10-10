Feature: Anki decks with many note types, and cloze cards
  A long-used Anki deck mixes note types (Basic, reversed, cloze, sentence cards, picture cards), each with its own
  fields. One word field per deck only fits the first note type, and the cards of every other type were skipped as
  empty. So each note type in a deck gets its own fields, and a cloze card syncs the word it hides.

  Background:
    Given I am signed in and connected to Anki

  # --- One setup per note type ---

  Scenario: Each note type in a deck is set up on its own
    Given a deck holds Basic, "Basic (and reversed card)", Cloze and "Sentence + Word" notes
    When I tick it in Settings → Anki
    Then each of its note types is listed with how many cards it has
    And each has its own word field, meaning field and three example words

  Scenario Outline: A sensible word field is picked for each note type
    Given a note type with the fields <fields>
    Then its word field starts as <picked>

    Examples:
      | fields                              | picked                  |
      | Front, Back                         | Front                   |
      | Sentence, Word, Translation         | Word                    |
      | Expression, Meaning, Reading        | Expression              |
      | Sentence, Target Word, Audio        | Target Word             |
      | Picture, Vocab, Notes               | Vocab                   |
      | Text, Back Extra (a cloze type)     | Text, read as cloze     |
      | Image, Sound                        | Image (the first field) |
    And a field named Word, Target Word, Target, Vocab, Vocabulary, Term, Expression or Front wins, in that order,
      whatever its capitals; otherwise the first field

  Scenario: Skipping a note type
    When I choose "Skip these cards" as a note type's word field
    Then its cards are never read or sent to us
    And the preview says how many cards were left out because their note type is skipped

  Scenario: A note type added to the deck later
    Given I set up a deck, and later add notes of a new type to it in Anki
    When a sync runs
    Then those cards are read with a word field picked as above
    And the Anki tab marks that note type "New: check its word field" until I save the deck again

  Scenario: Decks set up before this change keep working
    Given a deck saved with one word field for the whole deck
    Then every note type that has that field uses it
    And every other note type gets a word field picked as above and is marked "New: check its word field"

  # --- Cloze cards ---

  Scenario Outline: Each cloze card syncs the word it hides
    Given a cloze note whose text is "<text>"
    Then its card <card> is about "<word>"

    Examples:
      | text                                   | card | word     |
      | {{c1::perro}} come carne               | 1    | perro    |
      | El {{c1::perro}} come {{c2::carne}}    | 1    | perro    |
      | El {{c1::perro}} come {{c2::carne}}    | 2    | carne    |
      | {{c1::perro::dog}} come                | 1    | perro    |
      | {{c1::el}} {{c1::perro}} ladra         | 1    | el perro |
      | <b>{{c1::Perro}}</b> ladra             | 1    | perro    |

  Scenario: Only the hidden word leaves my computer
    When a cloze card syncs
    Then we receive only the word it hides, not the sentence around it

  Scenario: A cloze that hides a long passage
    Given a cloze card hides more than 12 words
    Then it is skipped as too long, like any other card

  Scenario: A cloze note type's examples show the hidden words
    When I tick a deck with cloze notes
    Then the cloze note type's examples are the words its cards hide, e.g. "perro, carne"
