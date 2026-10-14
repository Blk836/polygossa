Feature: The word card is always fully visible (#156)
  On wider screens (sm and up) the word card opened 8 px below the clicked word, whatever room there was below it.
  It was kept inside the page left-to-right but never top-to-bottom, so clicking a word near the bottom of the page
  cut off the bottom of the card: its status buttons and dictionary could not be seen or reached. On phones the card
  is a bottom sheet and is not affected.

  "The visible area" below is the window, less the docked media player (the bottom player bar or the floating mini
  player) when one is showing across the text.

  Background:
    Given I am signed in and read a lesson on a window at least "sm" wide

  Scenario: A word near the top still opens its card below it
    When I click a word on the first line of the page
    Then the card opens with its top 8 px below the word's bottom, as before
    And its left edge is at the word's left edge, kept inside the text column as before

  Scenario: A word near the bottom opens its card above it
    When I click the last word on the page
    And the card does not fit between the word and the bottom of the visible area
    Then the card opens with its bottom 8 px above the word's top
    And the whole card is inside the window

  Scenario: The card keeps clear of the docked player
    Given the lesson has audio and the bottom player bar is showing
    When I click the last word on the page
    Then the whole card is above the top of the player bar, not overlapping it
    Given instead the floating mini player is showing over the text
    When I click the last word on the page
    Then the whole card is above the mini player, not overlapping it

  Scenario: A card that fits neither below nor above is pushed up just enough
    Given a short window, where the card fits neither below nor above the clicked word
    When I click a word
    Then the card's bottom sits at the bottom of the visible area, so it covers as little of the word as it can
    And the card is no taller than the visible area: if its content is taller, it scrolls inside the card
    And no part of the card is outside the window

  Scenario: The card moves when its content changes height after opening
    Given I clicked a word near the bottom of the page, and its card opened above it
    When the card grows (the translation arrives, I open the dictionary section, or I switch from a phrase to one of
      its words and back)
    Then the card moves at once so its bottom stays 8 px above the word's top
    And the whole card stays inside the visible area

  Scenario: A card that opened below a word, and then grows past the bottom, moves up
    Given I clicked a word in the middle of the page, and its card opened below it
    When the card grows so it no longer fits below the word
    Then it moves above the word, or pushed up as above when it fits neither way

  Scenario: Phones keep the bottom sheet
    Given a phone-width window
    When I click the last word on the page
    Then the card is the bottom sheet across the window, as before
