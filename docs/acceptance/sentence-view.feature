Feature: Reading one sentence at a time
  Beside the page view, the reader offers a sentence view for focused study: one sentence large in the middle, the
  one before and the one after faded above and below it, a smooth slide between them, the spoken word lit as audio
  plays, and a translation hidden under a blur until tapped. It is a second way to show the same lesson: word
  colours, the word card, saving words and phrases, and marking new words known when moving on all behave as they do
  on pages. LingQ has a sentence mode; ours is our own design, not a copy of theirs.

  Background:
    Given I am signed in and open a lesson in the reader

  # --- Choosing the view -----------------------------------------------------------------------------------------

  Scenario: The view is a reader setting: Pages or Sentences
    When I open the reader settings ("Aa")
    Then "View" offers Pages (the default) and Sentences
    When I pick Sentences
    Then the lesson shows one sentence at a time at once
    And the choice is remembered for every lesson, and the next lesson's first paint already uses it

  Scenario: Switching view keeps my place
    Given I am on page 3 in the page view
    When I switch to Sentences
    Then the sentence shown is the first sentence that starts on page 3
    When I move on two sentences and switch back to Pages
    Then the page shown is the one holding that sentence

  Scenario: Reopening a lesson returns to the sentence I was on
    Given I left a lesson on sentence 12 in the sentence view
    When I open it again
    Then it opens on sentence 12

  # --- What the view looks like ----------------------------------------------------------------------------------

  Scenario: One sentence in focus, its neighbours faded around it
    Given a lesson of several sentences, on sentence 5
    Then sentence 5 is shown large and centred
    And sentence 4 is shown above it, smaller and faded, and sentence 6 below it the same way
    And the text size setting (A− / A+) scales the sentence in focus

  Scenario: The first and last sentences have nothing on one side
    When I am on the first sentence
    Then nothing is shown above it and "Previous sentence" is disabled
    When I am on the last sentence
    Then nothing is shown below it and "Next sentence" is disabled

  Scenario: A lesson of a single sentence
    Given a lesson that is one sentence long
    Then that sentence is shown in focus, with both "Previous" and "Next" disabled

  Scenario: Progress through the lesson is shown
    Given a lesson of 84 sentences, on sentence 12
    Then "12 / 84" is shown with a thin progress bar about a seventh full

  Scenario: A long sentence still fits without the page scrolling
    Given a sentence long enough to fill most of the screen
    Then the faded neighbours shrink or hide to make room, and the window itself never scrolls
    And a sentence taller than the space left scrolls inside its own area

  Scenario: Light and dark themes
    Then the sentence view uses the theme's colours in both light and dark mode

  # --- Moving between sentences ----------------------------------------------------------------------------------

  Scenario Outline: Moving to the next or previous sentence
    Given I am on sentence 5
    When I <action>
    Then sentence <shown> is in focus, sliding into place

    Examples:
      | action                                    | shown |
      | press the right arrow                     | 6     |
      | press the left arrow                      | 4     |
      | click "Next sentence"                     | 6     |
      | click "Previous sentence"                 | 4     |
      | click the faded sentence below            | 6     |
      | click the faded sentence above            | 4     |
      | swipe left on a phone                     | 6     |
      | swipe right on a phone                    | 4     |

  Scenario: With reduced motion, sentences change without sliding
    Given my system asks for reduced motion
    When I move to the next sentence
    Then it appears in place without animation

  Scenario: Clicking a word in a faded sentence opens the word, not the sentence
    Given the faded sentence below holds the word "gato"
    When I click "gato" there
    Then the word card opens for "gato"
    And the sentence in focus stays the same

  # --- Words, as on pages ----------------------------------------------------------------------------------------

  Scenario: Words look and click the same as on pages
    Then new words are blue, learning words yellow and known words plain, also in the faded sentences
    And "Quiet colours" quiets them here too
    When I click a word in the sentence in focus
    Then the same word card opens, with the same actions and shortcuts (1–5, K, …)

  Scenario: A phrase can be made with shift-click as on pages
    When I shift-click two words of the sentence in focus
    Then they become a phrase I can save, as on pages

  Scenario: The sentence in focus can be saved for review
    When I click "Save sentence"
    Then it is saved as a phrase, as the word card's "Save sentence to review" does
    And the button reads "✓ Sentence saved"

  # --- Moving on marks new words known (the page view's rule, per sentence) --------------------------------------

  Scenario: Moving forward marks the sentence's remaining blue words known
    Given "Turning the page marks new words known" is on
    And the sentence in focus has three blue words, one yellow word and one known word
    When I move to the next sentence
    Then the three blue words become known, everywhere they appear in the lesson
    And the yellow word stays yellow
    And my known-word count goes up by three

  Scenario: People's names are set aside, as on pages
    Given the sentence in focus has a blue word that was found to be a person's name
    When I move to the next sentence
    Then that name is treated as it is when turning a page

  Scenario: Moving back marks nothing
    Given the sentence in focus has blue words
    When I move to the previous sentence
    Then those words stay blue

  Scenario: Jumping around with audio marks nothing
    Given audio is playing
    When I press "[" to go back a sentence
    Then nothing is marked known

  Scenario: With the setting off, moving on marks nothing
    Given "Turning the page marks new words known" is off
    When I move to the next sentence
    Then the blue words stay blue

  Scenario: A sentence with no blue words sends nothing
    Given every word in the sentence in focus is yellow or known
    When I move to the next sentence
    Then no request is made to mark words known

  Scenario: If marking known fails, I'm told and nothing changes colour
    Given the server fails to mark words known
    When I move to the next sentence
    Then an error message says the words weren't saved
    And the next sentence is still shown, and the words of the previous one stay blue

  Scenario: Finishing the last sentence works as finishing the last page
    Given I am on the last sentence
    When I finish the lesson
    Then its remaining blue words are marked known (if the setting is on)
    And the same finish panel appears as at the end of the page view

  # --- Audio and video -------------------------------------------------------------------------------------------

  Scenario: The spoken word is lit inside the sentence
    Given a lesson with word-timed audio, in the sentence view
    When the audio plays
    Then the word being spoken is marked in the sentence in focus, moving word to word

  Scenario: The view follows the audio into the next sentence
    Given audio is playing on sentence 5
    When the audio reaches sentence 6
    Then sentence 6 slides into focus by itself
    And sentence 5's blue words are marked known, as when the audio turns a page

  Scenario: Moving by hand while playing jumps the audio there
    Given audio is playing on sentence 5
    When I press the right arrow
    Then sentence 6 is in focus and the audio plays from its start

  Scenario: The player's sentence tools work here
    Then R replays the sentence in focus, "[" and "]" step sentences, loop repeats the sentence in focus,
      and the speed choice applies, as in the page view

  Scenario: Pausing after each sentence, for shadowing
    When I turn on "Pause after each sentence" (shown in the sentence view's controls)
    Then the audio stops at the end of each sentence, staying on it
    And Space or "Next sentence" carries on with the next one
    And the choice is remembered

  Scenario: A video sits with the sentence
    Given a video lesson in the sentence view
    Then the video is shown above the sentence on a phone, and beside or above it on a wide screen, as the video
      layout setting says
    And the sentence in focus follows the video as it plays

  Scenario: A lesson without audio
    Given a lesson with no audio or video
    Then the sentence view works with the arrows alone, and no player is shown

  # --- Translation, hidden until asked for -----------------------------------------------------------------------

  Scenario: On Pro, the translation waits under a blur
    Given I am on Pro
    Then under the sentence in focus is a blurred "Tap to see the translation" area
    And no translation has been asked for yet
    When I tap it
    Then the sentence's translation into my own language appears there

  Scenario: Each translation is asked for only once
    Given I revealed the translation of sentence 5
    When I move to sentence 6 and back to sentence 5
    Then sentence 5's translation is shown blurred again, and revealing it again makes no new request

  Scenario: A new sentence starts with its translation hidden
    Given I revealed the translation of sentence 5
    When I move to sentence 6
    Then sentence 6's translation area is blurred and unrequested

  Scenario: Without Pro, the translation area points to Pro
    Given I am on the free plan
    Then in place of the blurred area is "Sentence translations with Pro", linking to the subscription page

  Scenario: When translation is unavailable, reading carries on
    Given I am on Pro and the AI service fails or my allowance is used up
    When I tap to see the translation
    Then a short message says it couldn't be translated (or the allowance message, as in the word card)
    And the sentence and its words keep working
