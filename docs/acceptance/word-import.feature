Feature: Import my words from LingQ and Readlang (see docs/architecture/reading.md)
  A learner switching from LingQ or Readlang brings their whole vocabulary with them, so the reader colours
  their words correctly from day one. Imports run in the background: the learner starts one, can leave the page, and
  sees its progress and result on the Vocabulary page.

  How we reach each service:
  - LingQ: its official API, with the learner's personal API key (lingq.com/accounts/apikey). We never ask for their
    LingQ password, and the key is used only while the import runs: it is never stored or shown again.
  - Readlang: its public API is discontinued, so the learner uploads the word list they export from Readlang
    (CSV or tab-separated). We don't ask for their Readlang login or session.

  Background:
    Given I am signed in

  # --- Starting an import ---

  Scenario: Starting a LingQ import
    When I enter my LingQ API key, choose French and click "Import from LingQ"
    Then the import is queued at once and I see it as "Importing…" with the words found so far
    And I can leave the page; the import keeps going on the server

  Scenario: LingQ import of every language
    When I start a LingQ import without choosing a language
    Then it imports every language we support (Spanish, French, German, Italian, Portuguese, Japanese, Chinese,
      Korean), and languages I don't study on LingQ add nothing

  Scenario: Starting a Readlang import
    When I upload my Readlang export file, choose French and click "Import from Readlang"
    Then the import is queued and runs in the background like a LingQ one

  Scenario Outline: Invalid starts are rejected at once
    When I start an import with <problem>
    Then I get 400 with a message saying what is wrong, and no import is queued

    Examples:
      | problem                                                   |
      | an empty LingQ API key                                    |
      | a LingQ API key with spaces or symbols, or over 100 chars |
      | an unsupported language                                   |
      | a Readlang import without a language                      |
      | an empty Readlang file, or one with no words in it        |
      | a Readlang file over 5 MB                                 |

  Scenario: One import at a time
    Given one of my imports is queued or running
    When I start another
    Then I get 409 "An import is already running"

  Scenario: Other learners' imports are private
    When I ask for another learner's import by its id
    Then I get 404

  # --- What LingQ gives us ---

  Scenario: All of my LingQs and known words come across
    Given my LingQ account has 450 LingQs and 1,200 known words in French, over several pages
    When the import runs
    Then it reads every page of my LingQs (cards) and of my known words
    And it sends my API key as "Authorization: Token <key>" and nothing else of mine

  Scenario Outline: LingQ statuses become ours
    Given a LingQ with <lingq>
    Then it is imported as <ours>

    Examples:
      | lingq                                          | ours     |
      | status 0, 1 or 2 (new, recognised, familiar)   | learning |
      | status 3 (learned) with extended status 0      | learning |
      | status 3 with extended status 3 (known)        | known    |
      | status 4                                       | known    |
      | a word in the known-words list                 | known    |

  Scenario: Hints and context come too
    Given a LingQ with the hint "house" and the fragment "Une maison bleue"
    Then my word gets the definition "house" and the context sentence "Une maison bleue"

  Scenario: Phrases stay phrases
    Given a LingQ "tout à fait"
    Then it is imported as a phrase

  # --- What Readlang gives us ---

  Scenario Outline: Readlang files are read flexibly
    Given a Readlang export <shape>
    Then every row with a word becomes a learning word, with its translation as the definition and its context
      sentence

    Examples:
      | shape                                                                 |
      | with a header row naming Word, Translation and Context (any order)    |
      | without a header row: word, translation, context                      |
      | separated by tabs instead of commas                                   |
      | with quoted fields holding commas, quotes ("") and a byte-order mark  |
      | with blank lines and rows without a word, which are skipped           |

  # --- Merging into my vocabulary ---

  Scenario: An import never lowers what I know
    Given I already have "maison" as known and "chat" as ignored
    When an import says both are being learned
    Then "maison" stays known and "chat" stays ignored

  Scenario: An import can raise a word to known
    Given I have "chien" as learning
    When an import says it is known
    Then "chien" becomes known

  Scenario: My own definitions are kept
    Given "maison" already has my definition "home"
    When an import brings the hint "house"
    Then the definition stays "home"; empty definitions and context sentences are filled in

  Scenario: The same word twice in one import
    Given an import lists "Maison" as learning and "maison" as known
    Then I get one entry "maison", known

  Scenario: Imported known words count as known before I joined
    When an import adds known words
    Then my known-word total and levels include them at once
    But they don't count as words learned this week (progress charts, growth figures)

  # --- Plan limits ---

  Scenario: The Free plan's saved-word limit
    Given I am on the Free plan with 10 saved learning words left
    When an import brings 30 new learning words and 500 known words
    Then the first 10 learning words and all 500 known words are imported
    And the result says 20 words weren't imported because of the Free plan's limit, with a link to the plans

  # --- Progress and results ---

  Scenario: Seeing the result
    When an import finishes
    Then it shows "Done" with how many words were found, added, updated, unchanged, and over the plan limit

  Scenario: Recent imports are listed
    When I open the Vocabulary page
    Then my last 5 imports are shown, newest first, with their source, language, state and counts
    And while one is running the page refreshes its progress every few seconds

  # --- Failures ---

  Scenario: LingQ rejects the key
    Given LingQ answers 401 or 403
    Then the import fails with "LingQ didn't accept this API key. Copy it again from lingq.com/accounts/apikey."
    And nothing from it is saved

  Scenario: LingQ asks us to slow down
    Given LingQ answers 429 with Retry-After
    Then the import waits (at most 30 seconds) and tries that page again, up to 3 times

  Scenario: LingQ is down partway
    Given LingQ fails on the third page (5xx, timeout or unreadable reply) after retries
    Then the import fails with "LingQ couldn't be reached. Try again later." and the words already imported stay

  Scenario: Unreadable items are skipped
    Given a LingQ page holds an item without a term
    Then that item is skipped and the rest are imported

  Scenario: A server restart interrupts an import
    Given an import was queued or running when the server stopped
    When the server starts again
    Then the import shows as failed with "Interrupted: please start it again"
    And starting it again is safe: words already imported come out unchanged

  Scenario: The key never leaks
    Then the LingQ API key is never stored, logged or returned by any request

  # --- Showing progress ---

  Scenario: Clicking Import gives instant feedback
    When I click "Import from LingQ"
    Then the button at once shows a spinner and reads "Starting…", and is disabled
    And clicking it again doesn't start a second import

  Scenario: A running import shows a spinner on its row
    Given my LingQ import has started
    Then its row shows a spinning indicator next to "LingQ · French · Importing…"
    And the counts below it update every couple of seconds as words arrive

  Scenario: Before the first words arrive
    Given my LingQ import has started but no words have arrived yet
    Then the row says "Fetching your words from LingQ…" instead of "0 found · 0 added · 0 updated · 0 unchanged"

  Scenario: The Import button while an import runs
    Given an import is running
    Then the Import button shows a spinner, reads "Importing…" and is disabled
    And the note says I can leave the page and the import keeps going

  Scenario: The spinner stops when the import finishes
    Given my import is running
    When it finishes
    Then the spinner disappears, the row reads "Done" with the final counts, and the button can be used again
    And my word list refreshes

  Scenario: The spinner stops when the import fails
    Given my import is running
    When it fails (for example, LingQ rejects the API key)
    Then the spinner disappears, the row reads "Failed" with the reason, and the button can be used again

  Scenario: Starting fails straight away
    When I click "Import from LingQ" and the server rejects it (for example, an invalid key)
    Then the button's spinner disappears, the button is usable again, and I see the error

  Scenario: Coming back to the page mid-import
    Given my import is running and I left the Words page
    When I come back to the Words page
    Then the running import's row shows the spinner again, even with the form closed

  Scenario: Screen readers and reduced motion
    Given an import is running
    Then a screen reader hears "Importing" once, not repeatedly on every refresh
    And with "reduce motion" turned on in my system settings, the indicator is a still dot instead of a spinner
