Feature: Practice → Words is split into Words and Phrases
  A saved sentence is a phrase: it is saved, listed and reviewed like any other phrase.

  Scenario: The page offers Words and Phrases
    Given I open Practice → Words
    Then I see the tabs "Words" and "Phrases", with "Words" selected
    And there is no "Sentences" tab and no "Words & phrases" type filter

  Scenario: The Words tab lists only single words
    Given I have saved the word "casa" and the phrase "por favor"
    When I am on the Words tab
    Then I see "casa" and not "por favor"

  Scenario: The Phrases tab lists only phrases
    Given I have saved the word "casa" and the phrase "por favor"
    When I open the Phrases tab
    Then I see "por favor" and not "casa"

  Scenario: Status, sort and search work on both tabs
    Given I am on the Phrases tab
    When I filter by "Known", sort A–Z, or search for "favor"
    Then only matching phrases are shown, in that order
    And switching to Words keeps the status, sort and search I chose

  Scenario: Saving a sentence in the reader makes it a phrase
    Given I am reading a text and open a sentence's popup
    When I click "Save sentence to review"
    Then the sentence appears on the Phrases tab, with its translation as its meaning and a link to the text
    And it is due for review like any new phrase

  Scenario: Saving the same sentence twice does not duplicate it
    Given I already saved a sentence as a phrase
    When I save it again from the reader
    Then the Phrases tab still shows it once

  Scenario: Sentences saved before this change become phrases
    Given I had saved sentences before this change
    When the update is deployed
    Then each one appears on the Phrases tab with its translation, notes, source text and review schedule unchanged
    And none of them is reviewed twice

  Scenario: An empty Phrases tab says how to add phrases
    Given I have no saved phrases
    When I open the Phrases tab
    Then I see a message explaining that I can select several words, or use "Save sentence to review" in the reader

  Scenario: Exporting still works
    When I export to CSV or Anki from either tab
    Then the export behaves as it does today

  Scenario: A saved sentence counts like any phrase
    Given I am on the free plan
    When I save a sentence to review
    Then it uses one of my saved-word slots, as any phrase does
    And it is highlighted in texts wherever it appears, as any saved phrase is
