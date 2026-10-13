Feature: Mark a video or text as watched/read without going through it (#153)
  A learner sometimes met a piece of content before it reached the app: they watched the video on YouTube or read the
  article elsewhere. A card's "Mark as watched" (video) or "Mark as read" (text) does in one step what finishing it in
  the reader does: the item counts as finished, and its new words (ones with no status yet) become known. Because it
  can turn hundreds of words known at once, it asks first and says how many; it can't be undone from the card (a word
  can still be set back from the reader or Vocabulary).

  Background:
    Given I am signed in
    And there is a text and a video in my language that I haven't finished

  Scenario: A card offers the action that fits its kind
    When I look at the text's card in my Library
    Then it has a "Mark as read" button
    And the video's card has a "Mark as watched" button

  Scenario: The action is on every card I can read from
    Then cards in Library, in Explore's shelves and search results, and in a playlist each have the action

  Scenario: It asks first, saying how many new words will become known
    Given the text has 7 unique words, 2 of which I already know and 1 I am learning
    When I press "Mark as read" on its card
    Then I am asked to confirm, told that 4 new words will be marked known
    And nothing has changed yet

  Scenario: Cancelling changes nothing
    When I press "Mark as read" and then cancel
    Then the card shows no "Finished" mark
    And my known-word count is unchanged

  Scenario: Confirming finishes it, as the reader would
    Given the text has 7 unique words, 2 of which I already know and 1 I am learning
    When I press "Mark as read" and confirm
    Then the card shows "Finished"
    And its new-word share shows 0%
    And my known-word count in the top bar rises by 4
    And the word I am learning is still learning
    And the card no longer offers "Mark as read"

  Scenario: Reopening the page keeps it finished
    Given I marked the video as watched
    When I reload my Library
    Then the video's card shows "Finished" and offers no "Mark as watched"

  Scenario: A finished item offers no action
    Given I finished the text in the reader
    Then its card has no "Mark as read" button

  Scenario: An item with no new words still asks, without a word count
    Given I already have a status for every word in the text
    When I press "Mark as read"
    Then the confirmation says no words will change
    And confirming marks it finished

  Scenario: Failure leaves the card as it was
    Given the server refuses to mark it
    When I press "Mark as read" and confirm
    Then I see an error
    And the card shows no "Finished" mark

  Scenario: Marking it gives the same result as finishing it in the reader
    Given two learners with the same vocabulary
    When one finishes the text in the reader and the other marks it as read
    Then both have the same words known, the same learning words, and the text finished
