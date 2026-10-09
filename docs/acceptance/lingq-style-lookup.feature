Feature: LingQ-style word lookup: meanings in my language, links out to dictionaries (see docs/architecture/reading.md)
  Wiktionary is no longer used at all (neither the Free Dictionary API nor Wiktionary's own API). Like LingQ, the word
  popup shows short meanings in the learner's own language, from what other learners saved, else a machine
  translation, the same for every learner (English speakers included), and links out to full dictionaries on their
  own websites. Replaces word-translations.feature's Wiktionary steps and native-language.feature's popup scenarios.

  Background:
    Given I am signed in and reading French

  # --- The meaning line, the same for everyone ---

  Scenario Outline: Every native language gets a meaning line, English included
    Given my native language is <native>
    And nobody has saved a meaning for "maison"
    When I look up "maison"
    Then Amazon Translate is asked once, French to <native>
    And the popup shows "<meaning>" labelled as a machine translation

    Examples:
      | native  | meaning |
      | English | house   |
      | Spanish | casa    |

  Scenario: Meanings other learners saved come first
    Given my native language is English, and 2 English-speaking learners saved "maison" as "home"
    When I look up "maison"
    Then the popup shows "home" labelled "saved by other learners"
    And Amazon Translate is not asked

  Scenario: Reading my own language
    Given my native language is French
    When I look up "maison"
    Then there is no meaning line and Amazon Translate is not asked, but the dictionary links are there

  Scenario: Stored answers, the monthly cap, failures, picking and editing a meaning
    Then they work as in word-translations.feature, for every native language

  Scenario: No meaning to show
    Given Amazon Translate is off, failing or over the cap, and nobody saved a meaning
    When I look up "maison"
    Then the popup says "No English meaning yet" and still shows the dictionary links

  Scenario: Phrases get a meaning line too
    When I select the phrase "tout à fait"
    Then the popup shows its machine translation (or others' saved meanings), stored like a word's

  # --- Links out to dictionaries ---

  Scenario: Dictionary links for my language pair
    Given my native language is English
    When I look up "maison"
    Then the popup links to Google Translate and DeepL with "maison" from French to English
    And to WordReference's French–English entry for "maison"
    And each opens in a new tab

  Scenario: WordReference only where it has the pair
    Given my native language is Turkish
    When I look up "maison"
    Then the popup links to Google Translate and DeepL, French to Turkish, and not to WordReference

  # --- What goes away with Wiktionary ---

  Scenario: No dictionary definitions, IPA, examples or base form any more
    When I look up any word
    Then the popup shows no English definitions, part of speech, IPA, dictionary examples or "form of …" link
    And the speaker button still reads the word aloud with the browser's voice
    And no request goes to freedictionaryapi.com or wiktionary.org

  Scenario: What a saved word keeps
    When I save "maison" while the popup shows "house"
    Then its meaning and its definition are "house"
    So review cards, the Words page, CSV and Anki exports show "house"

  # --- Pro ---

  Scenario: Pro asks the AI for an explanation on demand
    Given I am on Pro
    When I click "Explain with AI" in the popup
    Then the AI's definitions, in my language, appear in the popup (counting against the daily AI limit)
    And nothing calls the AI until I click
