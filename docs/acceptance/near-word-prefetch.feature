Feature: Blue words near the mouse are translated before they are clicked
  Clicking a blue (new) word waits for the AI to find its meaning in the sentence. When the mouse comes near a blue
  word, the reader asks for its meaning straight away, so by the time the word is clicked the meaning is usually
  ready. "Near" is generous: within 60 px of the word's edges.

  Background:
    Given I am reading a lesson on a computer with a mouse
    And the page has blue words

  Scenario: A blue word near the mouse is translated before it is clicked
    When I move the mouse to within 60 px of a blue word, without touching it
    Then its meaning is asked for
    When I then click the word
    Then the popup shows the meaning without asking for it again

  Scenario: Every blue word within reach is asked for, nearest first
    When I rest the mouse where three blue words are within 60 px
    Then all three meanings are asked for, the nearest word first

  Scenario: A blue word further away is not asked for
    When the mouse stays more than 60 px from a blue word
    Then its meaning is not asked for

  Scenario: Only blue words are asked for
    Given a yellow (learning) word, a known word and a blue word are all within 60 px of the mouse
    Then only the blue word's meaning is asked for

  Scenario: Each word is asked for once
    When I move the mouse back and forth over the same blue word several times
    Then its meaning is asked for only once
    And clicking it while the answer is still on its way waits for that same answer instead of asking again

  Scenario: The same word in another sentence is asked for separately
    Given the same blue word appears in two sentences near the mouse
    Then its meaning is asked for in each sentence, since the meaning can differ

  Scenario: Sweeping across the page doesn't ask for more than a few at a time
    When I sweep the mouse quickly across many lines of blue words
    Then at most 4 meanings are on their way at once
    And words the mouse has already left are dropped from the queue before they are asked for

  Scenario: Translating ahead doesn't count as looking a word up
    When a blue word's meaning is asked for because the mouse came near
    Then the word stays blue and isn't recorded as looked up
    And it is recorded only when I click it, as before

  Scenario: Words on the next page wait until I turn to it
    When I turn the page
    Then the old page's words that were still waiting are not asked for
    And words on the new page are asked for as the mouse comes near them

  Scenario: A failed translation ahead stays quiet, and clicking tries again
    Given asking for a blue word's meaning fails while the mouse is near it
    Then no error shows
    When I click the word
    Then its meaning is asked for again and shown

  Scenario: Touch screens are unchanged
    Given I am reading on a phone or with a touch screen
    When I touch the page
    Then no meaning is asked for until I tap a word, as before
