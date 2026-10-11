Feature: Pages in the account menu show their own loading outline, however fast they're opened (#132)
  The account menu's links (Settings, Classes, and Admin for admins) only existed once the menu was open, so their
  pages were prefetched only then, in two steps. Picking one straight away often beat the second step, and the page
  showed the general "Loading page" outline instead of its own. The outline test for Classes failed now and then
  (and mostly, on a loaded machine) because of it.

  Scenario: Classes shows its own outline even when picked straight after opening the menu
    Given any page of the app has finished loading
    When I open the account menu and pick Classes at once
    Then the Classes outline shows while it loads, not the general one
    And the page then fills in without moving

  Scenario: The menu's pages are prefetched once the page has loaded, before the menu is opened
    Given any page of the app has finished loading
    Then Settings and Classes (and Admin, for admins) have been prefetched
    And opening the menu fetches nothing more for them
