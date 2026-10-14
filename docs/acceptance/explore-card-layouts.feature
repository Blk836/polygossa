Feature: Explore's Compact and List layouts look different (#151)
  On Explore's opening view (its shelves), Compact and List both drew the same narrow cards, because a shelf turned
  List into Compact. A shelf now shows List as rows: the cover beside the title, stacked a few high, and the shelf
  still scrolls sideways a column at a time. Category and search results (a grid) already followed all three.

  Background:
    Given I am signed in on a desktop-sized window
    And Explore has shared texts and videos in my language

  Scenario: Compact keeps narrow cards on the shelves
    When I pick "Compact" on Explore
    Then each shelf's cards are narrower than with "Cards"
    And each card shows its cover above its title

  Scenario: List shows rows on the shelves, unlike Compact
    When I pick "List" on Explore
    Then each shelf shows rows with the cover beside the title, not above it
    And the rows are shorter and wider than Compact's cards
    And a shelf with more than three items stacks them three high, in columns that scroll sideways

  Scenario: Switching between Compact and List changes the shelves each time
    Given I picked "Compact" on Explore
    When I pick "List"
    Then the shelves show rows
    When I pick "Compact" again
    Then the shelves show narrow cards again

  Scenario: Every Explore shelf follows List: picked for you, playlists and categories
    When I pick "List" on Explore
    Then the "Continue reading"/"For you" shelves, the shared playlists shelf and the category shelves all show rows

  Scenario: Actions stay on the rows
    When I pick "List" on Explore
    Then each row still has its like, bookmark and "Add to playlist" buttons
    And a recommended row still has "Not interested"

  Scenario: A search grid still follows all three layouts
    When I search Explore for a title
    Then "Cards", "Compact" and "List" each give a different results layout: 4 columns, 6 columns, one row per item

  Scenario: On a phone, List rows fit the screen
    Given I am on a phone-sized window
    When I pick "List" on Explore
    Then the shelves show rows that fit within the screen's width
    And the page itself doesn't scroll sideways

  Scenario: The loading outline matches the layout
    Given I picked "List"
    When Explore's shelves are still loading
    Then their outline shows rows, not cards
