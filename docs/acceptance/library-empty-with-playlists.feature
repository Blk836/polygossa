Feature: The library's empty state knows about playlists

  Scenario: Playlists but nothing saved
    Given I have a French playlist
    And I have no French texts or videos imported or bookmarked
    When I open My library
    Then the saved list says "Nothing saved outside your playlists"
    And it suggests bookmarking a text or video to keep it here
    And it does not show the "Import a text or video" or "Explore shared content" buttons

  Scenario: Nothing at all
    Given I have no French playlists and nothing imported or bookmarked
    When I open My library
    Then it says "No French texts or videos yet" with the Import and Explore buttons, as today

  Scenario: Filters that match nothing
    Given I have a playlist and a saved text
    When I filter so that nothing matches
    Then it says nothing matches, with "Clear filters", as today
