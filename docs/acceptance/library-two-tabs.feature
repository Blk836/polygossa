Feature: Library in two sub-tabs, Explore first
  The Library tab had four sub-tabs (Mine, Saved, Explore, Playlists) that mixed "my things" with "find new things",
  and showed playlists in four places. It now has two: Explore (everything public, where the tab opens) and
  My library (everything that is yours: imports, saved items and playlists, in one list with a Source filter).
  No backend change: the existing list endpoints are combined in the page.

  Background:
    Given I am signed in

  # Navigation
  Scenario: The Library tab opens Explore, with two sub-tabs
    When I click the Library tab (or the logo)
    Then I am on Explore
    And the sub-tabs read "Explore", "My library", with Explore current

  Scenario: Places that sent me to the library now land on Explore
    Then signing in with no page to return to lands on Explore
    And a signed-in visit to the login or sign-up page goes to Explore
    And "Skip for now" in onboarding, "Read something new" in Review, "Continue reading" on the streak card,
      "Start reading" for the reading level and "Open library" on the landing page all open Explore

  Scenario: My library is the second sub-tab
    When I click "My library"
    Then I am on /library, the page is headed "My library", and "My library" is the current sub-tab

  Scenario: Old pages still work
    When I open /library/saved
    Then I land on My library with the Source filter set to Saved
    When I open /playlists or a playlist's page
    Then the Library tab is current and "My library" is the current sub-tab

  # My library: one list
  Scenario: My imports and my saved items are in one list
    Given I imported "Mine A" and saved someone else's shared text "Theirs B" in Explore
    When I open My library
    Then both cards are listed, my imports first, then saved items
    And "Theirs B" shows its owner's name; "Mine A" doesn't

  Scenario: Something I imported and also saved is listed once
    Given I saved my own shared text "Mine A"
    Then My library lists "Mine A" once, as mine (with my owner actions)

  Scenario: The Source filter
    Given My library holds "Mine A" (imported) and "Theirs B" (saved)
    When I open Filters and pick Source "Imported"
    Then only "Mine A" is listed, the Filters badge counts 1, and a "Imported" pill removes the filter
    When I pick Source "Saved"
    Then only "Theirs B" is listed
    When I pick Source "All" (or "Clear all")
    Then both are listed again

  Scenario: The Source filter combines with type and category
    Given the type filter is Videos and a category chip is picked
    Then the list shows only items matching all three, and the Filters badge counts each filter behind the button

  Scenario: Different actions for my items and saved items
    Then a card I own has my owner actions (rename, re-file, share, delete) and the playlist button
    And a saved card has the playlist button and "Unsave", and no delete

  Scenario: Unsaving an item
    When I click "Unsave" on "Theirs B"
    Then it leaves My library straight away, and Explore shows it as not saved
    But when unsaving fails, the card stays and the error is shown

  Scenario: Empty My library
    Given I have nothing imported or saved in Spanish
    Then My library says "No Spanish texts or videos yet" with "Import a text or video" and "Explore shared content"

  Scenario: Empty after filtering
    Given I have imports but nothing saved
    When I pick Source "Saved"
    Then it says "No saved texts or videos" with "Clear filters"

  Scenario: The free-plan count names imports only
    Given I am on the free plan with 3 of 5 imports used
    Then the subtitle reads "3 of 5 imported texts and videos on the free plan (all languages). Saved items don't count."

  Scenario: Either list failing to load
    When the imports or the saved items fail to load
    Then My library shows the error, not an empty-library message

  # Playlists
  Scenario: One playlists row with mine and saved playlists
    Given I made "My course" and saved someone else's "Their course"
    Then My library's playlists row "Your playlists" shows both, each once
    And it links to "All playlists"

  Scenario: The playlists page has no Mine/Shared switch
    When I open All playlists
    Then it lists the playlists I made and the ones I saved, with the form to create one
    And there is no "Shared" switch or search there (shared playlists are found in Explore)

  Scenario: Explore search finds playlists too
    Given someone shared a French playlist "Podcast du jour"
    When I search Explore for "Podcast"
    Then a playlists row shows "Podcast du jour" above the matching texts and videos
    And a search with no matching playlists shows no playlists row

  # Tours
  Scenario: The first-visit tips point at controls that still exist
    Then Explore's "Keep it for later" tip points at the My library sub-tab and says saved cards wait there
    And the playlists tour has no tip about the Shared switch
