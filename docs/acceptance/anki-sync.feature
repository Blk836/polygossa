Feature: Anki progress keeps my known and learning words up to date
  A learner who reviews their vocabulary in Anki sees that progress here: a card that goes mature in Anki makes the
  word known in the reader, without marking it twice.

  How we reach Anki: AnkiWeb has no public API, so the learner's browser talks to the free AnkiConnect add-on in
  Anki desktop on their own computer (http://127.0.0.1:8765). Our server never contacts the learner's computer: the
  browser reads card progress from Anki and sends our backend only the word, its language and its card's state.
  Reviews done in AnkiMobile or AnkiDroid count once desktop Anki has synced them from AnkiWeb.

  Anki's states, as we read them:
  - mature: reviewed, and the next review is 21 or more days away (Anki's own definition)
  - young: reviewed at least once, next review less than 21 days away, or relearning after a lapse
  - new: never reviewed

  Background:
    Given I am signed in

  # --- Connecting ---

  Scenario: The Anki tab explains the set-up
    When I open Settings → Anki
    Then I see the steps: install Anki desktop, add AnkiConnect with code 2055492159, restart Anki, keep it open
    And a "Connect to Anki" button
    And a note that it needs Anki desktop on a computer, and that phone reviews count once desktop Anki has synced

  Scenario: Connecting for the first time
    Given Anki desktop is open with AnkiConnect, and hasn't allowed this site yet
    When I click "Connect to Anki"
    Then Anki shows its own dialog asking to allow this site
    And once I allow it there, the Anki tab shows "Connected" and lists my decks

  Scenario: Anki refuses this site
    When I click "Connect to Anki" and choose "Deny" in Anki's dialog
    Then the Anki tab says Anki refused the connection, with the config line that allows this site (our exact
      address in AnkiConnect's "webCorsOriginList") to paste in as an alternative
    And nothing is saved

  Scenario: AnkiConnect asks for its API key
    Given I set an API key in AnkiConnect's config
    When I click "Connect to Anki"
    Then I am asked for that key, and once it is right the decks are listed
    And the key is kept only in this browser, never sent to our server

  Scenario Outline: Anki can't be reached
    Given <situation>
    When I click "Connect to Anki"
    Then the Anki tab says "Can't reach Anki" with what to check: Anki open, AnkiConnect installed, Chrome allowed
      to reach this computer (and how to re-allow it in the site settings)
    And nothing else in the app changes or shows an error

    Examples:
      | situation                                            |
      | Anki desktop is closed                               |
      | AnkiConnect isn't installed                          |
      | I declined Chrome's "access devices on your network" |

  Scenario: An AnkiConnect too old to ask for permission
    Given AnkiConnect is older than version 6
    When I click "Connect to Anki"
    Then the Anki tab says to update AnkiConnect (Tools → Add-ons → Check for updates)

  # --- Choosing what counts ---

  Scenario: Decks exported from this app are recognised
    Given a deck of mine uses the note type from this app's Anki export
    Then it is offered already set up: the word comes from its "Word" field and the language from its "Language"
      field

  Scenario: Setting up one of my own decks
    When I tick another deck
    Then I choose which field holds the word (its fields are listed, the first one picked by default)
    And which language it is (my current study language by default)
    And optionally which field holds the meaning
    And I see three example words read from it, so I can check the field is right

  Scenario: My choices follow me
    Given I have chosen decks on one computer
    When I sign in on another computer with Anki
    Then the same decks and fields are used, without choosing again

  # --- Syncing ---

  Scenario: When a sync happens
    Given I have chosen at least one deck
    Then a sync runs when the app opens on a computer where Anki is reachable, and again every 15 minutes while
      the app is open
    And "Sync now" in the Anki tab runs one at once
    And on a computer without Anki, nothing runs and nothing is shown outside the Anki tab

  Scenario Outline: Anki's state becomes ours
    Given a card in a chosen deck for the word "perro" is <anki>
    And I <have> "perro"
    When a sync runs
    Then "perro" is <ours>

    Examples:
      | anki   | have                          | ours                     |
      | mature | have "perro" as learning      | known                    |
      | mature | don't have "perro" yet        | added as known           |
      | young  | don't have "perro" yet        | added as learning        |
      | young  | have "perro" as learning      | still learning           |
      | new    | don't have "perro" yet        | not added                |
      | new    | have "perro" as learning      | still learning           |

  Scenario: Anki never lowers a word
    Given I have "maison" as known and "chat" as ignored
    When Anki says "maison" lapsed and "chat" is young
    Then "maison" stays known and "chat" stays ignored

  Scenario: My own change in the app sticks until Anki has news
    Given "perro" became known through Anki
    When I set "perro" back to learning in the reader
    Then later syncs leave it learning while its card stays mature
    But if the card lapses and later goes mature again, "perro" becomes known again

  Scenario: Suspended and buried cards
    Given a mature card is suspended or buried in Anki
    Then it still counts as mature
    And a suspended card that was never reviewed counts as new

  Scenario: The same word on several cards
    Given "perro" has a young card and a mature card (for example, a forward and a reverse card)
    Then the most advanced card decides: "perro" is known

  Scenario Outline: Reading the word from a card
    Given a card's word field holds <field>
    Then it matches my word <word>

    Examples:
      | field                         | word                          |
      | "<b>Perro</b>&nbsp;"          | "perro"                       |
      | " perro "                     | "perro"                       |
      | "PERRO"                       | "perro"                       |
      | "tout à fait"                 | the phrase "tout à fait"      |
      | "[sound:perro.mp3]perro"      | "perro"                       |

  Scenario: Cards that aren't a word are skipped
    Given a card's word field is empty, longer than 12 words, or only an image or a sound
    Then it is skipped and counted as "skipped" in the sync's result

  Scenario: The meaning field fills an empty definition
    Given I chose a meaning field and "perro" has no definition of mine
    When a sync adds or updates "perro"
    Then its definition is the card's meaning (as plain text)
    But a definition I wrote myself is never replaced

  Scenario: A card deleted in Anki
    Given "perro" became known through Anki
    When I delete its card in Anki and a sync runs
    Then "perro" stays known, and goes back to my review queue here

  Scenario: The Free plan's saved-word limit
    Given I am on the Free plan with 10 saved learning words left
    When a sync would add 30 new learning words and 500 known words
    Then the first 10 learning words and all 500 known words are added
    And the sync's result says 20 weren't added because of the Free plan's limit, with a link to the plans

  Scenario: A big collection
    Given my chosen decks hold 20,000 cards
    When the first sync runs
    Then it sends them in batches and shows its progress in the Anki tab
    And the rest of the app stays usable meanwhile

  Scenario: Anki closes in the middle of a sync
    When Anki becomes unreachable during a sync
    Then the batches already sent are kept
    And the Anki tab says "Sync stopped: Anki closed" and the next sync carries on

  Scenario: Two tabs open at once
    Given the app is open in two tabs
    Then only one of them syncs at a time, and the result is the same as one sync

  Scenario: Seeing the result
    When a sync finishes
    Then the Anki tab shows when it ran and how many words became known, were added, were skipped, and were over
      the plan limit

  # --- Progress counts ---

  Scenario: The first sync counts like an import
    When the first sync of a deck makes words known
    Then my known-word total and levels include them at once
    But they don't count as words learned this week (progress charts, growth figures)

  Scenario: Later syncs count as learning progress
    Given a deck has synced before
    When a later sync makes "perro" known
    Then it counts as a word learned today

  # --- My review queue here ---

  Scenario: Words reviewed in Anki leave the Review tab
    Given "perro" matches a card in a chosen deck
    Then "perro" is not in my Review tab's queue
    And the Review tab says how many of my words are reviewed in Anki, linking to Settings → Anki

  Scenario: Words not in Anki are reviewed here as before
    Given "gato" matches no card in my chosen decks
    Then "gato" is in my Review tab's queue as before

  Scenario: Disconnecting
    When I untick a deck, or click "Disconnect Anki"
    Then my words keep the status they have now
    And the words linked only through it go back to my Review tab, with the schedule they had before

  # --- Explaining it to the learner ---

  Scenario: The Anki tab says how it works, in plain words
    When I open Settings → Anki
    Then a "How Anki sync works" section says:
      | Cards that are mature in Anki (next review 21+ days away) make the word known here.             |
      | Cards you are still learning in Anki make the word learning here; cards never reviewed don't count. |
      | Anki only ever moves a word up: forgetting a card in Anki doesn't make a known word unknown.     |
      | If you change a word yourself here, Anki leaves it alone until that card changes again.          |
      | Words from your Anki decks that you haven't met here yet are added to your words.                |
      | Words you review in Anki leave the Review tab here, so you never review the same word twice.     |
      | Reviews on your phone count once Anki desktop has synced them, and Anki desktop is open here.    |
    And on the Free plan it adds that new learning words count toward the saved-word limit
    And once I have synced, the section is folded away under "How it works" and opens on a click

  Scenario: A preview before the first sync changes anything
    Given I have chosen my decks and never synced them
    When I click "Preview"
    Then I see, before anything changes:
      | how many of my words will become known                                  |
      | how many words will be added as known, and how many as learning         |
      | how many are over the Free plan's limit, with a link to the plans       |
      | how many cards are skipped, and why (empty, too long, image or sound)   |
      | how many words will leave the Review tab here                           |
    And a line saying these words count toward my known total, but not as words learned this week, since I
      learned them before
    And each number opens the list of its words
    When I click "Start syncing"
    Then the first sync runs and later ones run on their own
    But if I leave without clicking it, nothing has changed

  Scenario: Seeing which words changed
    When I open the result of a sync
    Then each count opens the list of its words, so I can see exactly what Anki changed

  Scenario: The word popup says where its status came from
    Given "perro" is known because of its mature Anki card
    When I click "perro" in the reader
    Then the popup says "Known through Anki"
    When I set it to learning there
    Then the popup says Anki won't change it back until its card changes in Anki

  Scenario: The Review tab says why words are missing
    Given 340 of my words are reviewed in Anki
    Then the Review tab says "340 of your words are reviewed in Anki, so they aren't shown here", linking to
      Settings → Anki

  # --- Privacy ---

  Scenario: Only what's needed leaves my computer
    When a sync runs
    Then our server receives, for each card: the word, its language, its state, its deck's id and, if I chose one,
      its meaning
    And nothing else from my Anki collection

  Scenario: Other learners' Anki settings are private
    Then no request can read or change another learner's chosen decks or Anki-linked words
