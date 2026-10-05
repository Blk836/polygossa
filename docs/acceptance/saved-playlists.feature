Feature: Saving playlists
  Texts and videos in Explore have a Save button that keeps them under Library > Saved; playlists had none.
  Playlists get the same Save / Saved toggle, and saved playlists show up on the Saved page.

  Background:
    Given I am signed in
    And another learner has shared a French playlist "Podcast" with one public text

  # API
  Scenario: Saving a shared playlist
    When I PUT /api/playlists/{Podcast}/bookmark
    Then the response is 204
    And GET /api/playlists/saved lists "Podcast" with bookmarked = true
    And "Podcast" has bookmarked = true in GET /api/playlists/shared and GET /api/playlists/{Podcast}

  Scenario: Saving twice is a no-op, unsaving removes it, unsaving again is a no-op
    Given I have saved "Podcast"
    When I PUT /api/playlists/{Podcast}/bookmark again
    Then GET /api/playlists/saved lists "Podcast" once
    When I DELETE /api/playlists/{Podcast}/bookmark
    Then the response is 204
    And GET /api/playlists/saved no longer lists it, and it has bookmarked = false in the shared list
    When I DELETE /api/playlists/{Podcast}/bookmark again
    Then the response is 204

  Scenario: Playlists I haven't saved say so
    Then every playlist in GET /api/playlists/shared and GET /api/playlists has bookmarked = false

  Scenario: Saved playlists are mine only, newest save first, and follow the language
    Given I saved "Podcast" and then a shared Spanish playlist "Recetas"
    Then GET /api/playlists/saved lists "Recetas" before "Podcast"
    And GET /api/playlists/saved?language=fr lists only "Podcast"
    And the other learner's GET /api/playlists/saved lists neither

  Scenario: Someone else's private playlist can't be saved
    Given another learner has a private playlist "Secret"
    When I PUT /api/playlists/{Secret}/bookmark
    Then the response is 404
    And saving a playlist id that doesn't exist is 404 too

  Scenario: My own playlist can be saved, like my own shared texts
    When I save my own playlist
    Then the response is 204 and it is listed in GET /api/playlists/saved

  Scenario: A saved playlist that stops being shared drops out of Saved until it is shared again
    Given I have saved "Podcast"
    When its owner makes it private
    Then GET /api/playlists/saved doesn't list it
    When its owner shares it again
    Then it is listed again

  Scenario: Deleting a saved playlist removes it from everyone's Saved
    Given I have saved "Podcast"
    When its owner deletes it
    Then the delete succeeds (204)
    And GET /api/playlists/saved doesn't list it

  Scenario: Requires sign-in
    When I GET /api/playlists/saved without a session
    Then the response is 401

  # UI (Playwright)
  Scenario: Explore's playlist shelf has a Save button on each card
    Given "Podcast" is shared in the language picked in the top bar
    When I open Explore
    Then the "Podcast" card shows a "Save" button, not pressed
    When I click it
    Then it reads "Saved" and is pressed, without opening the playlist pane
    And after reloading Explore it still reads "Saved"

  Scenario: Saved playlists appear on Library > Saved, and can be unsaved there
    Given I have saved "Podcast"
    When I open /library/saved
    Then a "Saved playlists" shelf shows the "Podcast" card with a pressed "Saved" button
    When I click "Saved"
    Then it reads "Save" and the playlist is no longer saved on the server

  Scenario: The Shared tab on /playlists has Save buttons; My playlists doesn't
    When I open /playlists and switch to Shared
    Then the "Podcast" card shows a "Save" button
    And the cards under My playlists show no Save button

  Scenario: A playlist's own page can be saved by a non-owner
    When I open /playlists/{Podcast}
    Then I see a "Save" button next to Start
    When I click it
    Then it reads "Saved"

  Scenario: Saving fails
    Given the server rejects the save
    Then the button goes back to "Save"
