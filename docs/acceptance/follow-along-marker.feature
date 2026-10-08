Feature: Follow-along marker while audio or video plays
  While a text's audio or video plays, the reader shows where the speaker is at two levels: a quiet tint on the
  sentence being spoken (where am I?) and a thin marker under the word being spoken (what am I hearing?) that slides
  from word to word instead of jumping. It replaces the yellow fill on the spoken word, which looked like the
  "learning" colour and hid the word's own colour while it was spoken.

  Background:
    Given I am reading a text with synced audio or a video with word timings

  # --- The word marker ---------------------------------------------------------------------------------------------

  Scenario: The spoken word is underlined, not filled
    When playback reaches a word
    Then a marker bar sits under that word, as wide as the word
    And the word keeps its own colour: blue if new, yellow if learning, plain if known or ignored

  Scenario: The marker slides to the next word on the same line
    Given the marker is under a word
    When playback reaches the next word on the same line
    Then the marker slides and stretches to the new word over at most 150 ms
    And at no moment are two words marked

  Scenario: A short word does not leave the marker behind
    When the next word starts sooner than the slide would finish
    Then the slide is shortened so the marker reaches the word before the following one starts

  Scenario: The marker does not slide diagonally across a line break
    Given the marker is under the last word of a line
    When playback reaches the first word of the next line
    Then the marker fades out at the end of the line and fades in under the new word
    And it never travels across the text between the two lines

  Scenario: Skipping ahead or back moves the marker without a long slide
    When I seek, step to another sentence, or choose "Play from here" on a word far away
    Then the marker appears under the new word without sliding across the words in between

  Scenario: Reduced motion
    Given my device asks apps to reduce motion
    When playback moves from word to word
    Then the marker moves to each word at once, without sliding or fading

  Scenario: Between words and after playback stops
    When there is a pause in speech longer than the gap a word is allowed to linger over
    Then the marker fades out until the next word starts
    When I pause playback
    Then the marker stays under the word I paused on
    When I close the audio panel or playback ends
    Then the marker and the sentence tint disappear

  Scenario: The marker follows the text when it reflows
    Given the marker is under a word
    When I change the text size or resize the window so the lines rewrap
    Then the marker is still under the same word, not where the word used to be

  Scenario: Turning the page with playback
    When playback reaches a word on the next page and the reader turns the page
    Then the marker appears under that word on the new page without sliding from where it was

  # --- The sentence tint ---------------------------------------------------------------------------------------------

  Scenario: The sentence being spoken is tinted
    When playback reaches a word
    Then every word of its sentence has a quiet tint behind it, and nothing else does
    And the tint is fainter than the new-word blue and learning yellow, so word colours still read on top of it

  Scenario: The tint moves sentence by sentence
    When playback crosses into the next sentence
    Then the tint fades from the old sentence to the new one

  Scenario: A sentence split across two pages
    Given a sentence starts at the bottom of one page and ends on the next
    Then the tint covers the part of the sentence on the page shown

  # --- Choosing what to show -----------------------------------------------------------------------------------------

  Scenario: Follow along with the sentence only
    Given I open Reader settings
    When I set "Follow along" to "Sentence"
    Then playback tints the sentence but shows no word marker
    And the choice is remembered the next time I open any text, like the other reader settings

  Scenario: The default
    Given I have never changed "Follow along"
    Then playback shows both the sentence tint and the word marker

  Scenario: Quiet colours do not hide where playback is
    Given "quiet colours" is on in Reader settings
    When playback reaches a word
    Then the sentence tint and the word marker still show

  # --- Interplay with looking things up ------------------------------------------------------------------------------

  Scenario: A selected word stays clearly selected
    Given I have clicked a word to look it up while playback continues
    When the marker reaches that word
    Then the word still shows as selected, and the marker shows under it as well

  Scenario: Learning phrases keep their underline
    Given a phrase I am learning has its underline
    When the marker passes under a word of that phrase
    Then both the phrase underline and the marker can be told apart

  # --- Colours ---------------------------------------------------------------------------------------------------------

  Scenario: Readable in light and dark mode
    Then the marker and the tint have their own colours in both themes, distinct from the learning yellow
    And text on the tint meets WCAG AA contrast, like every other text colour pair
