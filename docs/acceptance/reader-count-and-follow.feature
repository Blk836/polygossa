Feature: The known-words count keeps up while reading, and playback marks only the spoken word by default

  # --- The top bar's known-words count ----------------------------------------------------------------------------
  # It was only fetched again when moving to another app page, so it stayed put while reading.

  Scenario: Turning the page updates the count
    Given "Turning the page marks new words known" is on
    And the note says "Turning the page marks the 9 new words on this page as known."
    When I turn to the next page
    Then the known-words count in the top bar goes up by 9, without leaving the reader

  Scenario: Setting a word's status updates the count
    When I mark a word known in the reader
    Then the known-words count in the top bar goes up by 1
    When I set it back to learning
    Then the count goes down again

  Scenario: Finishing the lesson updates the count
    When I finish the lesson and its remaining new words become known
    Then the known-words count in the top bar includes them

  # --- Follow along: the word underline only, by default ------------------------------------------------------------
  # The sentence tint covered the words coming up, hiding whether they were new, learning or known.

  Scenario: By default playback underlines the spoken word only
    Given I have never changed "Follow along"
    When audio or video plays
    Then the marker slides under the spoken word as before
    And no sentence is tinted, so every word shows its own colour

  Scenario: The sentence tint can be turned back on
    Given I open Reader settings
    Then "Follow along" offers "Word" (the default), "Word and sentence" and "Sentence"
    When I choose "Word and sentence"
    Then playback tints the spoken sentence and underlines the spoken word
    When I choose "Sentence"
    Then playback tints the spoken sentence with no word marker
    And the choice is remembered the next time I open any text

  Scenario: A choice saved before this change keeps working
    Given I had set "Follow along" to "Sentence" before this change
    Then playback still tints the sentence with no word marker
