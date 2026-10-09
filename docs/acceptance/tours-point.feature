Feature: Every tour tip points at what it explains
  Review's and Write's tours had one tip about the page as a whole, shown at the bottom of the screen with nothing
  highlighted, which looked misplaced (feature-tours.feature). Now every tip sits beside the part of the page it is
  about, highlighted, like the other pages' tours.

  Scenario: Review's tour points at the daily goal, then the card
    Given I am on a paid plan and haven't seen Review's tour
    When I open Review
    Then the first tip sits beside the daily goal bar, which is highlighted
    And the next tip sits beside the flashcard (or "All caught up" when nothing is due), highlighted

  Scenario: Write's tour points at where a test starts
    Given I am on a paid plan with a language picked, and haven't seen Write's tour
    When I open Write
    Then the tip sits beside the "Start a writing test" panel, which is highlighted

  Scenario: Playlists' second tip points at Explore
    When I reach the second tip of the Playlists tour ("Playlists from others")
    Then it sits beside the Explore tab, which is highlighted

  Scenario: No tip is left without a target
    Then every tip of every tour names the control it explains

  Scenario: On a phone the tips still fit
    When I open Review on a phone
    Then the tip fits the screen and stays above the tab bar
