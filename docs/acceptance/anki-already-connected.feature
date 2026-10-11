Feature: Settings → Anki opens connected when the account already is
  The Anki tab started every visit with a "Connect to Anki" button, even for an account with decks saved, and clicking
  it just said "Connected to Anki". It read as "you've been disconnected" (issue #105). When decks are saved, the tab
  now checks Anki quietly on opening: a plain call that never makes Anki ask for permission.

  Background:
    Given I am signed in on Settings → Anki

  Scenario: Connected, with Anki open on this computer
    Given my account has a deck saved and Anki is open and already lets this site in
    When I open the Anki tab
    Then it says "Connected to Anki" straight away and shows my decks, with the saved one ticked
    And there is no "Connect to Anki" button
    And Anki was not asked for permission

  Scenario: Coming back to the tab
    Given my account has a deck saved and Anki is open
    When I go to another Settings tab and back to Anki
    Then it says "Connected to Anki" again, without a click

  Scenario: While the quiet check runs
    Given my account has a deck saved and Anki is slow to answer
    When I open the Anki tab
    Then it says "Checking Anki…" and shows no connect button
    And once Anki answers, it says "Connected to Anki"

  Scenario: Connected, but Anki isn't running right now
    Given my account has a deck saved and Anki is closed
    When I open the Anki tab
    Then it says my account is connected to Anki but this browser can't reach it right now
    And it offers "Reconnect to Anki", not "Connect to Anki"
    And the Sync with Anki panel and "Disconnect Anki" are still there
    When I open Anki and click "Reconnect to Anki"
    Then it says "Connected to Anki" and shows my decks

  Scenario: Connected from another computer or browser
    Given my account has a deck saved and Anki here hasn't let this site in yet
    When I open the Anki tab
    Then it says my account is connected but this browser can't reach Anki right now
    And Anki was not asked for permission
    When I click "Reconnect to Anki" and allow it in Anki
    Then it says "Connected to Anki"

  Scenario: Anki needs its API key and this browser has it
    Given my account has a deck saved, AnkiConnect asks for an API key, and this browser kept it
    When I open the Anki tab
    Then it says "Connected to Anki" straight away

  Scenario: Anki needs its API key and this browser doesn't have it
    Given my account has a deck saved, AnkiConnect asks for an API key, and this browser has none
    When I open the Anki tab
    Then it says my account is connected but this browser can't reach Anki right now
    When I click "Reconnect to Anki"
    Then it asks for the API key

  Scenario: Never connected
    Given my account has no decks saved
    When I open the Anki tab
    Then it shows the set-up steps and "Connect to Anki" as before
    And Anki is not contacted until I click it
