Feature: Japanese, Chinese and Korean are not offered for learning (for now)
  The app splits Japanese, Chinese and Korean into "words" with crude built-in rules and shows no readings, so they
  aren't good enough to learn with (docs/product-gaps.md, item 16). Until they are, the languages you can learn are
  English, Spanish, French, German, Italian and Portuguese. This is a pause, not a deletion: anything already stored in
  those three languages stays in the database, untouched, ready for when they come back. Japanese, Chinese and Korean
  stay available as native languages (the language definitions are translated into), which doesn't depend on word
  splitting.

  # --- Choosing a language ---

  Scenario Outline: Language pickers offer only the six languages
    When I open <picker>
    Then it offers English, Spanish, French, German, Italian and Portuguese, in that order
    And not Japanese, Chinese or Korean

    Examples:
      | picker                                        |
      | the top-bar language switcher                 |
      | onboarding's "which language are you learning" |
      | the landing page's language choice and demo    |
      | the import form's language field              |
      | the word import's language field              |
      | a new class's language field                  |
      | a new playlist's language field               |

  Scenario: Native languages are unchanged
    When I choose my native language in Settings
    Then Japanese, Chinese and Korean are still offered, with every other native language as before

  Scenario: The server refuses them as a learning language
    When I set my learning language to "ja", "zh" or "ko" (PATCH /api/me)
    Then the request fails with 400 and a message that the language isn't offered
    And my learning language is unchanged

  Scenario: Someone already learning one of them is asked to choose again
    Given my learning language was set to Japanese before this change
    When I open the app
    Then it behaves as if I had no learning language yet: I'm asked to choose one of the six
    And my Japanese texts, words and progress are kept in the database, not deleted

  Scenario: A landing-page link with one of them falls back
    When a visitor opens the sign-up link with ?lang=ja
    Then sign-up and onboarding start with no language picked, as for an unknown code

  # --- No new content in them ---

  Scenario Outline: New content in those languages is refused
    When I <action> in Japanese, Chinese or Korean
    Then it fails with 400 and a message that the language isn't offered, and nothing is saved

    Examples:
      | action                                           |
      | import a text (pasted, URL, file)                |
      | import a video                                   |
      | import an e-book or PDF                          |
      | import words                                     |
      | create a class or a playlist                     |

  Scenario: The bulk video importer skips them
    Given a video list with one line in Japanese among Spanish ones
    When the curator tool runs it
    Then the Japanese line fails with the "not offered" message and goes to the retry file
    And the Spanish videos import as before
    And the curator options (GET /api/curator/options) list only the six languages

  Scenario: No starter texts for them
    When the app starts on an empty database
    Then six starter texts are seeded, one per offered language, and none in Japanese, Chinese or Korean

  # --- Existing content stays out of sight ---

  Scenario: Lists never show them
    Given texts in Japanese exist, including an earlier starter text
    When anyone lists Library, Explore, the community library, playlists or recommendations
    Then no Japanese, Chinese or Korean item appears
    And asking a list for one of them (?language=ja) fails with 400

  Scenario: Nothing is deleted
    Given texts, words, reading progress and review history in Korean
    When the app starts after this change
    Then all of it is still in the database, unchanged

  # --- Docs ---

  Scenario: The docs say what the product does
    Then docs/architecture lists the six learning languages and says the other three are paused
    And CLAUDE.md says six starter texts are seeded
