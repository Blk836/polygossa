Feature: Hovering a learning phrase shows what a click opens

  Background:
    Given I have saved "besoin de dormir" as learning

  Scenario: Hovering any word of the phrase underlines the whole phrase
    When I hover "de"
    Then "besoin", "de", "dormir" and the spaces between them show the hover line
    And words outside the phrase don't

  Scenario: Moving off the phrase clears it
    Given I hovered "de"
    When I move the mouse to a word outside the phrase
    Then only that word shows the hover line

  Scenario: Overlapping phrases underline the one a click opens
    Given I have also saved "de dormir bien" as learning
    When I hover "bien"
    Then "de dormir bien" shows the hover line
    And "besoin" does not

  Scenario: Hovering an ordinary word is unchanged
    When I hover a word outside any learning phrase
    Then only that word shows the hover line
