Feature: A learning phrase is yellow wherever its words appear, whatever separates them

  Background:
    Given I am reading a French text

  Scenario: A non-breaking space between the words
    Given the text has "voix" and "haute" separated by a non-breaking space
    When I select "voix haute" and mark it as learning
    Then "voix haute" is shown as one yellow box at once
    And it is still yellow after I reload the page

  Scenario: A narrow non-breaking space, a line break or several spaces between the words
    Given the text has "voix" and "haute" separated by a narrow non-breaking space, a line break, or two spaces
    When I mark "voix haute" as learning
    Then "voix haute" is yellow in each of those places, before and after reloading

  Scenario: A curly apostrophe in the text
    Given the text says "l’eau froide" with a curly apostrophe
    When I mark "l’eau froide" as learning
    Then it is yellow, before and after reloading

  Scenario: A learning phrase inside a known phrase
    Given I have marked "à voix haute" as known
    When I mark "voix haute" as learning
    Then "voix haute" is yellow and "à" is not
    And after reloading "voix haute" is still yellow, whichever phrase was saved first

  Scenario: A known phrase inside a learning phrase
    Given I have marked "voix haute" as known
    When I mark "à voix haute" as learning
    Then all of "à voix haute" is yellow, before and after reloading

  Scenario: A phrase the text does not contain stays out
    Given I have saved "voix basse" as learning from another text
    When I open a text with only "voix haute"
    Then nothing is yellow as a phrase
    And the text's details do not list "voix basse"

  Scenario: Words split differently do not join into a phrase
    Given I have saved "voix haute" as learning
    And the text says "voixhaute" with no separator
    Then nothing there is yellow as a phrase
