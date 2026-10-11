Feature: Settings → Anki keeps deck setup folded away once connected
  Issue #119: a learner who has already connected Anki comes back to Settings → Anki for sync status, Sync now and
  Disconnect, but the page still showed the whole deck list with every deck's language and note type. Deck setup is a
  one-time job, so once the account is connected it folds into a closed section, like "How it works" on the same page.

  Scenario: Already connected, the deck settings start folded
    Given my account has Anki decks saved and Anki desktop is reachable
    When I open Settings → Anki
    Then I see "Connected to Anki"
    And the deck settings are in a closed "Your decks" section
    And its title says how many decks are set up and their languages, e.g. "Your decks · 2 decks · Spanish, French"
    And the sync panel and "Disconnect Anki" are visible without opening anything

  Scenario: Opening the section shows the full deck settings
    Given the closed "Your decks" section
    When I click its title
    Then I see every deck with its language and note-type settings and "Save decks"

  Scenario: Saving from the opened section keeps it open and updates sync
    Given I opened "Your decks"
    When I change a deck's language and press "Save decks"
    Then I see "Saved" and the section stays open
    And the sync panel and the section title show the new choice

  Scenario: First-time setup is unchanged
    Given my account has no Anki decks saved
    When I connect to Anki
    Then the deck settings show open, not folded
    And after I save my first decks they stay open, showing "Saved"

  Scenario: Connected on the account, but Anki desktop can't be reached
    Given my account has Anki decks saved and Anki desktop is closed
    When I open Settings → Anki
    Then I see that this browser can't reach Anki and a "Reconnect to Anki" button, as before
    And no deck settings are shown, as before

  Scenario: Disconnecting brings back the full first-time setup
    Given I am connected with decks saved
    When I press "Disconnect Anki" and connect again
    Then the deck settings show open, as for a first-time setup

  Scenario: A note type waiting for its word field opens the section
    Given my account has a deck saved, and a new note type has since appeared in it in Anki
    When I open Settings → Anki
    Then "Your decks" opens by itself, showing "New: check its word field" on that note type

  Scenario: After the first sync both sections start closed
    Given my decks have synced at least once
    When I open Settings → Anki
    Then "How it works" and "Your decks" are both closed
