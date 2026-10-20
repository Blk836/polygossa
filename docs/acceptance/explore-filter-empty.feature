Feature: Explore says "Nothing matches" when only the filter is empty (#181)
  With a level or type set and no shelf left, Explore claimed nothing was shared in the language at all.

  Scenario: A level with no matches
    Given Explore's shelves in a language with shared texts, none at A1
    When I pick level A1
    Then it says "Nothing matches" and "Try another level, type or search."
    And not "Nothing shared in this language yet"

  Scenario: Videos with no matches
    Given shared texts but no shared videos
    When I pick Videos
    Then it says "Nothing matches", with Polly in headphones

  Scenario: Nothing shared at all, with no filter
    Given nothing is shared in the language
    When Explore opens with no level or type picked
    Then it still says "Nothing shared in this language yet"
