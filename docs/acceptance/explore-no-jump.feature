Feature: Explore's rows appear together, in their final order
  Explore's top half is made of three things that load separately: the rows picked for you ("Continue reading", "For
  you", …), shared playlists, and the category rows. Each used to appear as soon as it arrived, so the playlists (quick
  to load) showed at the top, then a moment later the rows picked for you were put above them and pushed them out of
  view. Now the rows wait for each other.

  Scenario: Nothing shows in the wrong place while the rows load
    Given the rows picked for me are slow to arrive
    When I open Explore
    Then the shelves' outline shows
    And neither the shared playlists nor the category rows show yet
    When the rows picked for me arrive
    Then "Continue reading" and the other rows picked for me show first, then the playlists, then the category rows

  Scenario: Coming back to Explore shows the rows at once, in the same order
    Given I opened Explore and its rows showed
    When I go to another tab and come back while the rows are slow to refresh
    Then the rows picked for me, the playlists and the category rows show at once, in the same order

  Scenario: Rows that can't load don't hold the page
    Given the rows picked for me or the shared playlists fail to load
    When I open Explore
    Then the other rows show once they arrive, without the ones that failed
