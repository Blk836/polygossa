Feature: The vocabulary map draws only the levels chosen
  At "Up to A1" the map also drew every A2 word as a grey rim, so Home (10 of 11 A1 words known) looked
  mostly grey: whole provinces with no A1 words were drawn from A2 tiles alone, and A2 words I already know
  were grey too. Now only the words up to the chosen level get tiles. This supersedes "The next level is a
  pale rim" (vocabulary-map-grows-by-level.feature) and the next band's tiles in vocabulary-map.feature.

  Background:
    Given I learn French, whose list has the bands A1 to C1
    And I am on Progress, looking at the vocabulary map

  Scenario: A nearly finished province looks nearly finished
    Given Rooms & furniture has 11 A1 words, and I know 10 of them
    And it has 15 A2 words, some of which I know
    When I choose "Up to A1" and zoom into Rooms & furniture
    Then it has exactly 11 tiles: 10 known-coloured and 1 new
    And none of its A2 words has a tile

  Scenario: A province with no words at the level chosen is left off
    Given Household chores has no A1 words
    When I choose "Up to A1" and zoom into Home
    Then Household chores has no tiles and no name tag
    And Home shows only the provinces that have A1 words
    When I choose "Up to A2"
    Then Household chores appears, with a tile for each of its A2 words

  Scenario: A country with no words at the level chosen is left off
    Given a country whose words are all A2 or above
    When I choose "Up to A1"
    Then that country is not on the island and can't be focused with the keyboard

  Scenario: Zoomed into a province that disappears at the new level
    Given I am zoomed into Household chores at "Up to A2"
    When I choose "Up to A1"
    Then the view moves out to Home, and the breadcrumb and address say so

  Scenario: Each level draws exactly its own words
    When I choose "Up to A2"
    Then the island has a tile for each A1 and A2 word, and none for B1, B2 or C1
    And every tile is coloured by my status: known, learning or new
    When I choose "Up to C1"
    Then it has a tile for every word in the list

  Scenario: The next level is still mentioned as a count
    When I choose "Up to A1"
    Then each country and each drawn province still says e.g. "+15 at A2"
    And a province's word list shows only the A1 words, with no faint A2 words after them

  Scenario: The island still fits and grows
    When I switch between the levels
    Then the island is one landmass that fits the map, and it gets bigger as the level goes up

  Scenario: On a phone at A1, one landmass comes before every name tag
    Given I am on a phone, zoomed all the way out, at "Up to A1"
    Then at most one country's name tag is hidden, because the island is too small for all 14 to fit
    And no two name tags overlap
    And from "Up to A2" every country has its name tag

  Scenario: Counts don't change
    When I choose any level
    Then the header, country and province counts and coverage are the same as before this change
