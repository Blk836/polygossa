Feature: Landing page showreel — an animation that shows what the product does and why it pays off
  Below the hero, a short animation plays by itself and shows a visitor the whole loop without them doing anything:
  watch a video in the language → tap a word you don't know → review it in a few seconds → meet it again, now known →
  a month later the same kind of text is mostly words you know. It complements the hands-on demo in the hero (which
  you have to click) and ends on why it is worth it: reading gets comfortable once you know about 98% of the words,
  and the product's job is to get you there. It is honest: the figures in the scenes are labelled as an example, and
  the one research claim is a real, cited finding (Hu & Nation, 2000). No invented testimonials or user counts.

  Background:
    Given I am a signed-out visitor on /

  # What it shows
  Scenario: The showreel sits between the hero and "How it works"
    Then a section "See it in action" comes after the hero and before "How it works"
    And the header's section links include "See it in action"

  Scenario: It plays five scenes in order, by itself
    When I scroll the showreel into view and wait
    Then its scenes play in this order, each with a caption:
      | 1 | Watch something you love     |
      | 2 | Tap the words you don't know |
      | 3 | Review in seconds            |
      | 4 | Meet them again              |
      | 5 | Understand more every week   |
    And after the last scene it starts again from the first

  Scenario: Scene 1 — subtitles light up as they are spoken
    When scene 1 plays
    Then a video frame plays with a transcript beneath it, and the word being spoken is highlighted, moving forward word by word

  Scenario: Scene 2 — tapping a new word shows its meaning and saves it
    When scene 2 plays
    Then a pointer moves to the blue word "mariscos" and taps it
    And a definition card shows "mariscos — seafood"
    And the word turns yellow (learning) and a "Saved to your words" note appears

  Scenario: Scene 3 — a review card
    When scene 3 plays
    Then a flashcard shows "mariscos" with its sentence, turns over to "seafood", and "Easy" is chosen
    And it says when the word comes back next ("Next review in 4 days")

  Scenario: Scene 4 — the word is now known, and the count goes up
    When scene 4 plays
    Then a new sentence contains "mariscos" without a highlight (known)
    And the known-word counter counts up from 1,240 to 1,284

  Scenario: Scene 5 — the payoff
    When scene 5 plays
    Then "Day 1" and "Day 60" versions of the same paragraph are shown side by side, the Day 60 one with far fewer blue words
    And a meter for each fills to the share of words known (72% on Day 1, 97% on Day 60), marked "example"
    And a line says reading gets comfortable at about 98% of words known, citing Hu & Nation (2000)
    And a "Start reading free" button links to /signup

  # Control, accessibility and performance
  Scenario: Visitors can pause and resume
    When I press "Pause"
    Then the scene stops advancing and the button reads "Play"
    When I press "Play"
    Then it continues from where it stopped

  Scenario: Visitors can jump to a scene
    When I click the step "Review in seconds"
    Then scene 3 plays from its start and that step is marked current
    And steps are buttons, reachable and usable from the keyboard

  Scenario: Reduced motion
    Given my system asks for reduced motion
    When I open /
    Then the showreel does not play by itself: it shows scene 1 fully drawn, with the button reading "Play"
    And I can still step through the scenes with the step buttons

  Scenario: It only plays while it can be seen
    Given the showreel is scrolled out of view, or the tab is hidden
    Then it does not advance
    When it comes back into view
    Then it plays on (unless I paused it)

  Scenario: Screen readers get the story without the motion
    Then the showreel is a labelled region whose current caption is announced politely
    And the decorative pointer and frames are hidden from assistive technology

  Scenario: Theme and phones
    Then the showreel uses theme tokens only (light and dark), and at 390px wide nothing overflows horizontally

  # The timeline logic (unit tested)
  Scenario: Timeline maths
    Given the scene durations
    Then any elapsed time maps to one scene and a progress between 0 and 1 within it, wrapping after the last scene
    And jumping to a scene starts at that scene's start time
    And counters ease from their start to their end value as a scene progresses, never overshooting
    And the spoken-word index moves through the transcript in order and ends on the last word
