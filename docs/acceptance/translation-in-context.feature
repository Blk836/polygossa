Feature: A French word Amazon gives back unchanged is asked again with an article (see docs/architecture/reading.md)
  Amazon Translate returns some short French words as they are: "os" comes back as "os", while "un os" comes back as
  "A bone". Such words were stored as "no meaning", so every French-to-English learner saw "No English meaning yet".
  First version: French to English only. Other language pairs work as before (word-translations.feature).

  Background:
    Given machine translation is on, I am reading French, and my native language is English

  Scenario: An echoed word is asked again with "un"
    Given nobody has looked up "os" before
    And Amazon Translate returns "os" for "os" and "A bone" for "un os"
    When I look up "os"
    Then Amazon Translate is asked twice: "os", then "un os"
    And the popup shows "bone" labelled as a machine translation
    And "bone" is stored, so later lookups don't call Amazon Translate

  Scenario: The English article is taken off the answer
    Given the retry's answer starts with "A ", "An " or "The " (any case)
    Then the popup shows the answer without that article
    And an answer with no article is shown as it is

  Scenario: The retry also comes back unchanged
    Given Amazon Translate returns "Twitter" for "Twitter" and "un Twitter" for "un Twitter"
    When I look up "Twitter"
    Then the popup says "No English meaning yet"
    And that is stored, so Amazon Translate isn't asked again

  Scenario: The retry comes back as just the article
    Given the retry's answer, without its article, is empty or the word itself
    Then the popup says "No English meaning yet", and that is stored

  Scenario: A word Amazon translates the first time is asked only once
    Given Amazon Translate returns "house" for "maison"
    When I look up "maison"
    Then Amazon Translate is asked once, and the popup shows "house"

  Scenario: Phrases are not retried
    Given I selected the phrase "bon appétit" and Amazon Translate returns it unchanged
    Then Amazon Translate is asked once, and the popup says "No English meaning yet"

  Scenario: Other language pairs are not retried
    Given I am reading German, or my native language is Spanish
    And Amazon Translate returns the word unchanged
    Then Amazon Translate is asked once, and the word is stored as having no meaning, as before

  Scenario: The retry fails or is slow
    Given Amazon Translate returns "os" for "os"
    And the retry fails or takes longer than 3 seconds
    Then the popup says "No English meaning yet"
    And nothing is stored, so the next lookup tries both again

  Scenario: The retry counts against the monthly cap
    Given a retry is needed
    Then the characters of "un os" are counted against the monthly cap as well
    And if the cap is reached before the retry, it isn't sent and nothing is stored

  Scenario: Words already stored as having no meaning get asked again
    Given production has French-to-English words stored as having no meaning (such as "os")
    When the new version is deployed
    Then those stored "no meaning" answers are removed, so the next lookup of each asks Amazon Translate again
    And French-to-English words that have a meaning, and other language pairs, are left as they are
