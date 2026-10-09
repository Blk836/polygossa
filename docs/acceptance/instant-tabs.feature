Feature: Tabs switch instantly
  Clicking a tab used to leave the old page on screen until the server answered (about a quarter of a second, more
  on a slow line), and then the new page showed a spinner while its data loaded, every visit. Now the click switches
  at once, and a page you have already seen this session shows what it showed last time while it refreshes.

  Scenario: A click switches to the new tab at once
    Given I am on Explore
    And the server is slow to send the Library page
    When I click "My library"
    Then the address is /library straight away
    And an outline of a page is shown while the Library page is on its way
    And the Library page replaces the outline when it arrives

  Scenario: A tab I have seen shows its last content while it refreshes
    Given I opened My library and it showed my text "Le chat"
    And I went to Explore
    When I go back to My library while the server is slow to answer
    Then "Le chat" is shown at once, without a spinner

  Scenario: The refresh brings the content up to date
    Given I opened My library and it showed my text "Le chat"
    And the text was deleted while I was on Explore
    When I go back to My library
    Then "Le chat" may show briefly, and disappears once the fresh list arrives

  Scenario: A change I make on a page is kept for my next visit
    Given I am on My library
    When I unsave or delete an item there
    And I go to another tab and come back
    Then the item does not come back, not even for a moment

  Scenario: A page I have not seen yet still loads as before
    Given I have not opened Progress this session
    When I click "Progress"
    Then a loading indicator shows until its figures arrive

  Scenario: Each language and filter keeps its own content
    Given I saw My library in Spanish
    When I switch the top bar to French and open My library
    Then none of the Spanish items are shown, not even briefly

  Scenario: A failed refresh keeps the last content and says so
    Given I opened Progress and it showed my figures
    When I come back to Progress and the refresh fails
    Then the figures from before stay on screen
    And the error is shown above them

  Scenario: Remembered content stays in this browser tab only
    Given I opened some tabs
    When I reload the page, open the site in a new tab, or sign out
    Then nothing remembered is shown: every page loads fresh
    And nothing is written to the browser's storage
