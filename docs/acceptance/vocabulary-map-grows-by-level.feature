Feature: The vocabulary map's island grows with the level shown
  The map used to lay out every word up to C1 whatever level was chosen, so at "Up to A1" about 490 coloured
  tiles sat in small clusters inside a continent of about 7,900 faint ones. Now the island is made only of the
  words up to the chosen level and the next level's words, so it starts small and grows as the level goes up.

  This supersedes, in vocabulary-map.feature, "a hexagonal tile per word" (now: per word up to the next band)
  and "later bands' tiles paler still" (later bands are not drawn).

  Background:
    Given I learn French, whose list has the bands A1 to C1
    And I am on Progress, looking at the vocabulary map

  Scenario: At A1 the island is small, and it grows with the level
    When I choose "Up to A1"
    Then the island has a tile for each A1 and A2 word, and none for B1, B2 or C1 words
    When I choose "Up to A2"
    Then it has a tile for each word up to B1
    When I choose "Up to B1", then "Up to B2"
    Then the island gets bigger each time
    When I choose "Up to C1"
    Then it has a tile for every word in the list, as before

  Scenario: The next level is a pale rim
    When I choose "Up to A2"
    Then A1 and A2 words are coloured by my status, in the middle of each province
    And B1 words are pale tiles at the edge of their province
    And each country and province still says e.g. "+18 at B1"

  Scenario: Countries keep their places at every level
    When I switch between the levels
    Then Core words stays in the middle and the other countries keep their order around it
    And each country stays on the same side of Core, so the map still looks like the same world
    And only the exact borders change

  Scenario: Counts don't change, only the drawing
    Given I know 40 Food & Drink words up to A2
    When I choose "Up to A2"
    Then Food & Drink's tag and the header show the same counts as before this change

  Scenario: A province with no words yet at this level is left off
    Given a province whose words are all B2 or C1
    When I choose "Up to A2"
    Then that province has no tiles and no name tag at this level
    And its country is drawn without it
    When I choose "Up to B1"
    Then it appears, with its B2 words as the pale rim

  Scenario: A country with no words yet at this level is left off
    Given a country whose words are all B2 or C1
    When I choose "Up to A1"
    Then that country is not on the island and can't be focused with the keyboard

  Scenario: Zoomed in, switching level keeps my place
    Given I am zoomed into "Food & Drink › Fruit & vegetables"
    When I choose "Up to B2"
    Then I am still in Fruit & vegetables, and the view fits its new shape
    And the breadcrumb still reads "Map › Food & Drink › Fruit & vegetables"

  Scenario: Zoomed into a province that isn't drawn at the new level
    Given I am zoomed into a province whose words are all B2 or C1, at "Up to B1"
    When I choose "Up to A1"
    Then the view moves out to that province's country, and the breadcrumb and address say so

  Scenario: A known word keeps its tile
    Given I marked "pomme" known
    When I switch between the levels
    Then "pomme" always has a tile in Fruit & vegetables, coloured known

  Scenario: Switching level stays quick
    When I switch between the levels on a mid-range phone
    Then the new island shows within half a second
    And going back to a level I already looked at shows straight away
    And zooming and panning stay as smooth as before

  Scenario: Beyond the core stays in the open sea
    Given I know words that are not in the list
    When I switch between the levels
    Then "Beyond the core" sits in the sea off the island at every level, never on it

  Scenario: The island stays one continent
    When I switch between the levels
    Then the island is one landmass with no lakes inside it, at every level
    And every country and province is in one piece

  Scenario: No AI and no new libraries
    Then this works without AI and adds no libraries
