Feature: Anki sync shows where my words are
  Setting up Anki (connecting, choosing decks and note types) stays in Settings → Anki. Day-to-day sync lives on
  Practice → Words, beside the words it changes: when it last ran, when it runs next, what it changed, and a
  "Sync now" button. Words with an Anki card say so.

  Automatic sync still runs once when the app opens and every 15 minutes while it stays open, on a computer only.

  Background:
    Given I am signed in

  # --- The sync bar on Practice → Words ---

  Scenario: The bar shows when it last synced and when it syncs next
    Given Anki is connected and a deck has had its first sync
    And the last sync finished 4 minutes ago
    When I open Practice → Words
    Then a bar above my words says "Anki · synced 4 min ago · next sync in 11 min"
    And it has a "Sync now" button
    And the times move on by themselves while I stay on the page

  Scenario: Sync now
    Given Anki desktop is open
    When I click "Sync now" on the Words bar
    Then the bar shows "Syncing with Anki…" with how many cards it has read, e.g. "120 / 450"
    And "Sync now" can't be clicked again until it finishes
    And when it finishes the bar says "synced just now" and the 15-minute wait starts again
    And the word list reloads, showing the new statuses

  Scenario: An automatic sync shows on the bar too
    Given I am on Practice → Words
    When the 15-minute automatic sync runs
    Then the bar shows it syncing, then "synced just now"
    And the word list reloads

  Scenario: What the last sync changed
    Given the last sync made 3 words known and added 12 as learning
    When I open Practice → Words
    Then the bar says "3 words now known, 12 added"
    And clicking that shows the same lines as Settings → Anki ("3 of your words became known", …), each opening to
      its list of words

  Scenario: A sync that changed nothing
    Given the last sync changed no words
    Then the bar says only when it synced and when it syncs next, with no "changed" note

  Scenario: Anki desktop isn't open
    Given Anki desktop is closed
    When the automatic sync runs, or I click "Sync now"
    Then the bar says "Anki isn't open. Open Anki desktop and it'll sync within 15 min" with "Sync now" to try again
    And it still shows when the last good sync was
    And no error pops up anywhere else in the app

  Scenario: Anki closes in the middle of a sync
    Given a sync has started
    When Anki desktop closes before it finishes
    Then the bar says the sync stopped because Anki closed, and that the next sync carries on

  Scenario: Another tab is already syncing
    Given a sync is running in another tab
    When I click "Sync now"
    Then the bar says a sync is already running and to try again in a moment

  Scenario: On a phone or tablet
    Given Anki is connected
    When I open Practice → Words on a phone or tablet
    Then the bar says "Anki syncs from your computer · last synced 2 h ago"
    And there is no "Sync now" button and no "next sync" time

  Scenario: A deck that hasn't had its first sync yet
    Given Anki is connected but no deck has had its first sync
    When I open Practice → Words
    Then the bar says to preview and run the first sync in Settings → Anki, with a link there
    And there is no "Sync now" button

  Scenario: A new deck alongside ones already synced
    Given one deck has synced and I have just added another
    Then "Sync now" on the Words bar syncs only the deck that has synced before
    And the bar notes that the new deck needs its first sync in Settings → Anki, with a link there

  Scenario: Anki isn't connected
    Given I haven't connected Anki
    When I open Practice → Words on a computer
    Then a small line offers "Review in Anki? Connect it", linking to Settings → Anki
    And it has a ✕ that hides it, and it stays hidden in this browser
    And on a phone or tablet that line doesn't show

  Scenario: The bar follows the Words and Phrases tabs
    When I switch between Words and Phrases
    Then the same bar stays above both

  # --- The Anki badge on words ---

  Scenario Outline: A word with an Anki card shows a badge
    Given my word "<word>" has an Anki card that is <state>
    When I look at it on Practice → Words
    Then it shows an "Anki" badge
    And hovering or focusing the badge says "<explanation>"

    Examples:
      | word   | state  | explanation                                  |
      | casa   | mature | In Anki: mature card (next review 21+ days)  |
      | perro  | young  | In Anki: being learned                       |
      | gato   | new    | In Anki: not reviewed yet                    |

  Scenario: A word made known by Anki says so
    Given Anki made "casa" known
    Then its badge explanation also says "Known through Anki"

  Scenario: Words without an Anki card have no badge
    Given my word "mesa" isn't in any Anki deck
    Then it shows no Anki badge

  Scenario: Disconnecting Anki
    When I disconnect Anki in Settings → Anki
    Then Practice → Words shows no sync bar and no Anki badges

  # --- The other places ---

  Scenario: The Review tab points to the Words bar
    Given some of my words are reviewed in Anki
    When I open Practice → Review
    Then the line "12 of your words are reviewed in Anki, so they aren't shown here" links to Practice → Words
      instead of Settings

  Scenario: Settings → Anki shows the same last sync
    Given the last sync finished 4 minutes ago
    When I open Settings → Anki
    Then it says "synced 4 min ago · next sync in 11 min", matching the Words bar
    And it still keeps the full summary of the last sync and the "How it works" rules
    And the rules say automatic sync runs when the app opens and every 15 minutes while it's open on a computer

  Scenario: Settings keeps the first sync, Words does the rest
    Given every deck has had its first sync
    When I open Settings → Anki
    Then instead of "Sync now" it says syncing happens on Practice → Words, with a link there
    But a deck that hasn't had its first sync still shows "Preview" and "Start syncing" in Settings
