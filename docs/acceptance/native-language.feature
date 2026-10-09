Feature: Definitions in my native language (see docs/architecture/reading.md)
  Superseded in part (October 2026): Wiktionary is no longer used, so the popup scenarios here gave way to
  lingq-style-lookup.feature. The native-language setting itself still works as described.
  The free dictionaries are English Wiktionary, so a Spanish speaker learning German used to get English glosses.
  Each learner now has a native language (English by default). When it isn't English, the word popup leads with
  translations into it, found through English Wiktionary's translation tables, and AI help (Pro) answers in it.
  There is no sign-up flow worth the name yet, so the setting lives in Settings › Profile; new accounts start from
  the browser's language when it is one we offer.

  Background:
    Given I am signed in

  # --- The setting ---

  Scenario: English by default
    When I request GET /api/me
    Then nativeLanguage is "en"

  Scenario: Choosing my native language
    When I open Settings › Profile, pick "Español" under "Your native language" and save
    Then my nativeLanguage is "es", and GET /api/languages/native lists every native language on offer

  Scenario: An unknown native language is refused
    When I PATCH /api/me with nativeLanguage "xx"
    Then I get 400 and my native language is unchanged

  Scenario: Sign-up starts from the browser's language
    Given my browser's language is "pt-BR"
    When I sign up
    Then my native language is "pt"
    And when the browser's language is one we don't offer (e.g. "fi"), it is "en"

  # --- Translations in the popup ---

  Scenario: A German word for a Spanish speaker
    Given my native language is Spanish
    And Wiktionary defines German "Hund" as "dog", and the English entry "dog" translates to German "Hund" and
      Spanish "perro" in the same sense
    When I look up "Hund" in German
    Then the result carries translations ["perro"] in "es"
    And the English definitions are still there, below them

  Scenario: Only senses that lead back to the word count
    Given the English entry for the gloss also has a sense whose German translation is a different word
    Then that sense's Spanish translations are not offered

  Scenario: Learning English
    Given my native language is Spanish and I am learning English
    When I look up "dog"
    Then the translations come straight from the English entry's Spanish translations

  Scenario: Translations in the wrong script are dropped
    Given a Chinese translation listed under "zh" written in Cyrillic (Dungan)
    Then it is not offered to a Chinese speaker

  Scenario: No translation found
    Given no sense of the gloss leads back to the word
    When I look up the word
    Then translations are empty, and the popup says "No Spanish translation found" above the English definitions

  Scenario: English speakers see no change
    Given my native language is English (or the language I'm reading)
    When I look up a word
    Then no translation lookup is made and the result carries no translations

  Scenario: The translation source is down
    Given the dictionary API fails while translating
    Then the lookup still returns the English definitions, with no translations

  Scenario: Saving a word keeps the translation
    Given the popup shows translations "perro, can"
    When the word is saved
    Then its definition starts with "perro, can", followed by the English gloss

  # --- AI help in my language (Pro) ---

  Scenario: AI definitions, examples and translations use my native language
    Given my native language is Spanish and I am on Pro
    When the AI defines a word, writes an example or translates a sentence
    Then the prompt asks for the definition, the example's translation and the sentence translation in Spanish
