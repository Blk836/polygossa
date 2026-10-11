Feature: A learning phrase is a yellow box, and its words stay reachable

  Background:
    Given I am reading a French text containing "j'ai besoin de dormir"
    And I have saved the phrase "besoin de" as learning
    And "besoin" is new and "de" is known

  Scenario: A learning phrase looks like a learning word
    Then "besoin de" is shown as one continuous yellow box with rounded ends
    And there is no gap in the box between "besoin" and "de"
    And there is no underline on the phrase

  Scenario: Known and ignored phrases are not boxed
    Given I mark the phrase "besoin de" as known
    Then "besoin de" has no yellow box
    And "besoin" shows its own colour again

  Scenario: Clicking any word in the phrase opens the phrase
    When I click "de"
    Then the popup shows the phrase "besoin de" and its meaning

  Scenario: The phrase popup lists its words in their own colours
    When I click "besoin"
    Then the popup lists the words "besoin" and "de"
    And "besoin" is marked as new and "de" as known

  Scenario: Opening a single word from the phrase
    Given the popup shows the phrase "besoin de"
    When I choose the word "besoin"
    Then the popup shows the meaning of "besoin"
    And it offers a way back to "besoin de"

  Scenario: Going back to the phrase
    Given I opened the word "besoin" from the phrase "besoin de"
    When I choose "besoin de"
    Then the popup shows the phrase "besoin de" again

  Scenario: Changing a word from inside a phrase
    Given I opened the word "besoin" from the phrase "besoin de"
    When I mark "besoin" as learning
    Then the phrase popup lists "besoin" as learning
    And "besoin" elsewhere in the text is yellow
    And the phrase "besoin de" is still learning

  Scenario: The same word outside the phrase opens as a word
    Given "besoin" also appears on its own later in the text
    When I click that later "besoin"
    Then the popup shows the word "besoin", not the phrase

  Scenario: Overlapping learning phrases
    Given I have also saved "de dormir" as learning
    Then "besoin de dormir" shows as one yellow box
    When I click "dormir"
    Then the popup shows the phrase "de dormir"

  Scenario: Dark mode
    Given the reader is in dark mode
    Then the phrase box uses the same learning colour as a learning word
