Feature: The admin page in tabs, with a Translations tab showing how word lookups are answered and what they cost
  The admin page splits into tabs (Overview, Users, Translations, Log), each with its own address. The Translations
  tab answers, per language pair: is the layered way of finding a word's meaning working (how often a stored answer
  is reused rather than paid for), and what does it cost?
  A lookup tries, in order: a sentence meaning from the AI (only when the word comes with its sentence), the meanings
  other learners with the same native language saved (community), then Amazon Translate. Each lookup adds to one
  counter row per day (UTC), source language, target language and the layer that answered it, in one upsert, with no
  per-lookup rows. Counting starts when this ships: earlier days show nothing.

  Background:
    Given I am signed in as an admin

  # --- Tabs ---

  Scenario: The admin page opens on Overview
    When I open /admin
    Then the tabs Overview, Users, Translations and Log are shown, with Overview selected
    And Overview shows the stats tiles and charts that were on the page before

  Scenario: Each tab has its own address and survives a reload
    When I pick the Translations tab
    Then the address is /admin?tab=translations
    And after reloading, the Translations tab is still selected

  Scenario: An address with an unknown tab shows Overview
    When I open /admin?tab=nonsense
    Then Overview is selected

  Scenario: Users and Log keep what they did
    Then the Users tab has the user search, the user table and the user panel
    And the Log tab has the recent actions
    And an action taken on a user in the Users tab appears in the Log tab

  Scenario: Learners still never see the panel
    Given I am signed in as a learner
    When I open /admin?tab=translations
    Then I see "Only the team can use the admin panel"
    And GET /api/admin/translations answers 403

  # --- Which layer answered ---

  Scenario Outline: A lookup is counted under the layer that answered it
    Given machine translation and the AI are on, I read French and my native language is English
    And <situation>
    When I look up a French word
    Then today's French → English counters have one more lookup under "<layer>"

    Examples:
      | situation                                                              | layer          |
      | the AI already gave this word in this sentence a meaning               | AI, stored     |
      | the AI gives a meaning for this word in this sentence now               | AI, new        |
      | I look it up without a sentence and another learner saved a meaning     | community      |
      | there is no sentence or community meaning, and the word was translated before | machine, stored |
      | there is no sentence or community meaning, and Amazon translates it now | machine, new   |
      | nothing gives a meaning                                                 | nothing found  |

  Scenario: Counters are per language pair
    Given one lookup reading Spanish with French as my native language, and one reading French with English
    Then Spanish → French and French → English each have one lookup, in separate rows

  Scenario: A word looked up in my own native language is not counted
    Given I read English and my native language is English
    When I look up a word
    Then no counter changes, since no translation was needed

  Scenario: Several lookups at once all count
    When 10 lookups of the same pair and layer happen at the same moment
    Then that day's row has 10 more lookups

  # --- Calls, characters, tokens, failures ---

  Scenario: Amazon Translate's calls and characters are counted on the lookup they served
    Given Amazon returns the word "boitais" unchanged, and its marked sentence translated
    When I look it up in its sentence
    Then the lookup counts 2 Amazon Translate calls
    And the characters of the word plus the characters of the marked sentence

  Scenario: The AI's calls and tokens are counted from its reply
    Given the AI reply reports 120 tokens in and 8 tokens out
    When a lookup gets a new AI meaning
    Then the lookup counts 1 AI call, 120 tokens in and 8 tokens out

  Scenario: A lookup that used both services counts both
    Given the AI's answer can't be used, nobody saved a meaning, and Amazon translates the word
    Then the lookup is under "machine, new" and counts 1 AI call with its tokens and 1 Amazon call with its characters

  Scenario: A failed or timed-out call is counted as a failure
    Given the AI fails (an error or a timeout) and Amazon Translate fails
    When I look up a word in its sentence
    Then the lookup is under "nothing found", with 1 AI call and 1 AI failure, 1 Amazon call and 1 Amazon failure
    And a failed AI call counts no tokens

  Scenario: A lookup refused by the monthly character cap is counted as refused, not as a call
    Given this month's characters have reached the cap
    When a lookup would need Amazon Translate
    Then it counts 1 refused by the cap, no Amazon call and no characters

  # --- The Translations tab's numbers ---

  Scenario: Per pair, for the chosen period, with a total row
    Given counters for French → English and Spanish → French over the last 30 days, and some from 40 days ago
    When I choose 30 days (the choices are 7, 30 and 90; the default is 30)
    Then each pair shows its lookups and the share answered by each layer
    And the hit rate: the share answered without a new paid call (AI stored, community and machine stored)
    And Amazon Translate calls and characters, AI calls and tokens in and out
    And failures and lookups refused by the cap
    And a total row adds the pairs up
    And the counters from 40 days ago are left out

  Scenario: The estimated cost comes from configured prices
    Given prices are set to $15 per million Amazon Translate characters, $0.15 per million AI tokens in and $0.60 per
      million AI tokens out
    And a pair has 1,000 lookups, 200,000 characters, 1,000,000 tokens in and 100,000 tokens out
    Then its estimated cost is $3.00 + $0.15 + $0.06 = $3.21
    And its cost per 1,000 lookups is $3.21
    And with other prices configured the cost follows them

  Scenario: A pair with no lookups has no cost per 1,000 lookups
    Given a pair had calls counted but no lookups in the period
    Then its cost per 1,000 lookups is shown as "—", not a division by zero

  Scenario: What is stored so far, per pair
    Then each pair shows the words in machine_translations, how many of them are "no use" (no meaning)
    And the sentence meanings stored
    And the words with a meaning saved by learners with that native language
    And these are counted from the stored tables, so they include what was stored before counting started

  Scenario: The trend
    Then a daily chart shows lookups by layer over the period, with days without lookups at zero
    And a daily chart shows the estimated cost

  Scenario: This month against the cap
    Then this month's Amazon Translate characters are shown against the monthly cap

  Scenario: Nothing counted yet
    Given no lookups in the period
    Then the tab says no lookups were counted in this period, and still shows the cap and what is stored

  Scenario: Only a sensible period is accepted
    When GET /api/admin/translations is asked for 0 or 366 days
    Then it answers 400
