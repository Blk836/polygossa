Feature: English is a language you can learn (see docs/architecture/platform.md)
  English is the biggest learner market, so it joins the eight languages on offer, listed first. It is
  space-delimited, tokenized in Java like the European languages, and its dictionary is English Wiktionary
  (monolingual English definitions, or native-language translations once a native language is set: see
  native-language.feature).

  Scenario: English is offered everywhere languages are listed
    When I request GET /api/languages
    Then I get nine languages, English ("en", speech locale en-US) first
    And the top-bar language switcher, onboarding, Import, Settings and the landing page's picker all offer English

  Scenario: English text keeps contractions and possessives as single words
    When I import "Don't touch John's dog-friendly café, it's closed."
    Then the words are Don't, touch, John's, dog-friendly, café, it's, closed

  Scenario: An English starter text
    Given a fresh database
    When the app starts
    Then the community library has nine starter texts, one of them English (Daily life)

  Scenario: An existing library gains the English starter
    Given the community library was seeded before English existed (eight starters)
    When the app starts
    Then the English starter is added once, and the other eight are untouched
    And starting again adds nothing more

  Scenario: Reading levels for English use the European thresholds
    Given 3000 known English words
    Then my English reading level is computed with the same table as Spanish

  Scenario: The landing page demo
    When I pick English in the landing page's try-it-now reader
    Then an English sentence is shown with new and known words, each glossed
